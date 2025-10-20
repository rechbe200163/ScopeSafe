import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import {
  LIFETIME_TIER_PRICING,
  getLifetimeStripeProductId,
  type LifetimeTier,
} from '@/lib/lifetime';
import {
  analyzeLifetimePurchases,
  isLifetimeTierKey,
  resolveUserLifetimeStatus,
} from '@/lib/lifetime/purchases';
import { getActivePriceIdForProduct, stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const RESERVATION_TTL_MINUTES = 15;

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function getSuccessUrl(tier: Exclude<LifetimeTier, 'closed'>) {
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams({
    checkout: 'success',
    tier,
  });
  return `${baseUrl}/get-lifetime-access?${params.toString()}`;
}

function getCancelUrl(tier: Exclude<LifetimeTier, 'closed'>) {
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams({
    checkout: 'cancelled',
    tier,
  });
  return `${baseUrl}/get-lifetime-access?${params.toString()}`;
}

export async function POST() {
  const stripeClient = stripe;

  if (!stripeClient) {
    return NextResponse.json(
      { error: 'Stripe is not configured on the server.' },
      { status: 500 },
    );
  }

  const adminClient = createAdminClient();
  let pendingPurchaseId: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Lifetime checkout auth error:', authError);
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Please sign in to purchase lifetime access.' },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, name, stripe_customer_id, lifetime_tier')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to load user profile for lifetime checkout:', profileError);
      return NextResponse.json(
        { error: 'Unable to load your account details.' },
        { status: 500 },
      );
    }

    if (profile.lifetime_tier && isLifetimeTierKey(profile.lifetime_tier)) {
      return NextResponse.json(
        { error: 'Lifetime access is already active on this account.' },
        { status: 409 },
      );
    }

    const [
      { data: purchaseRows, error: purchaseError },
      { data: tierLimitRows, error: tierLimitError },
    ] = await Promise.all([
      adminClient
        .from('lifetime_purchases')
        .select(
          'id,tier,status,reserved_expires_at,user_id,created_at,stripe_session_id'
        )
        .in('status', ['pending', 'paid']),
      adminClient.from('lifetime_tier_limits').select('tier,max_slots'),
    ]);

    if (purchaseError) {
      console.error('Failed to load lifetime purchases:', purchaseError);
      return NextResponse.json(
        { error: 'Unable to verify lifetime availability.' },
        { status: 500 },
      );
    }

    if (tierLimitError) {
      console.error('Failed to load lifetime tier limits:', tierLimitError);
      return NextResponse.json(
        { error: 'Unable to verify lifetime availability.' },
        { status: 500 },
      );
    }

    const nowMs = Date.now();
    const { availability, activePurchases } = analyzeLifetimePurchases(
      Array.isArray(purchaseRows) ? purchaseRows : [],
      Array.isArray(tierLimitRows) ? tierLimitRows : [],
      nowMs
    );
    const userStatus = resolveUserLifetimeStatus(activePurchases, user.id, nowMs);

    if (userStatus.status === 'paid') {
      return NextResponse.json(
        { error: 'Lifetime access is already active on this account.' },
        { status: 409 },
      );
    }

    if (userStatus.status === 'pending') {
      return NextResponse.json(
        {
          error:
            'You already have a lifetime checkout in progress. Please finish the existing checkout to keep your reservation.',
        },
        { status: 409 }
      );
    }

    const { activeTier, remainingInTier } = availability;

    if (!activeTier || remainingInTier <= 0) {
      return NextResponse.json(
        { error: 'The lifetime offer is sold out.' },
        { status: 409 },
      );
    }

    const productId = getLifetimeStripeProductId(activeTier);

    if (!productId) {
      console.error(`Stripe product not configured for tier "${activeTier}".`);
      return NextResponse.json(
        { error: 'Stripe is not configured for this lifetime tier.' },
        { status: 500 },
      );
    }

    const price = LIFETIME_TIER_PRICING[activeTier];

    if (typeof price !== 'number') {
      console.error(`Lifetime price missing for tier "${activeTier}".`);
      return NextResponse.json(
        { error: 'Lifetime pricing is not configured for this tier.' },
        { status: 500 },
      );
    }

    const priceId = await getActivePriceIdForProduct(productId);

    if (!priceId) {
      return NextResponse.json(
        { error: 'Unable to resolve Stripe price for this tier.' },
        { status: 500 },
      );
    }

    const reservationExpiresAt = new Date(
      nowMs + RESERVATION_TTL_MINUTES * 60 * 1000
    ).toISOString();
    const amountCents = Math.max(Math.round(price * 100), 0);

    const { data: insertedPurchase, error: insertError } = await adminClient
      .from('lifetime_purchases')
      .insert({
        user_id: user.id,
        email: profile.email ?? null,
        tier: activeTier,
        status: 'pending',
        amount_cents: amountCents,
        currency: 'eur',
        reserved_expires_at: reservationExpiresAt,
        metadata: { source: 'checkout' },
      })
      .select('id')
      .single();

    if (insertError || !insertedPurchase) {
      console.error('Failed to reserve lifetime slot:', insertError);
      return NextResponse.json(
        { error: 'Unable to reserve a lifetime slot right now.' },
        { status: 500 },
      );
    }

    pendingPurchaseId = insertedPurchase.id;

    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: getSuccessUrl(activeTier),
      cancel_url: getCancelUrl(activeTier),
      metadata: {
        lifetimeTier: activeTier,
        supabaseUserId: user.id,
        lifetimePurchaseId: pendingPurchaseId,
      },
      client_reference_id: user.id,
    };

    if (profile.stripe_customer_id) {
      sessionPayload.customer = profile.stripe_customer_id;
    } else {
      sessionPayload.customer_creation = 'always';
      sessionPayload.customer_email = profile.email ?? undefined;
    }

    const session = await stripeClient.checkout.sessions.create(sessionPayload);

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL.');
    }

    const updatePayload: Record<string, unknown> = {
      stripe_session_id: session.id,
      updated_at: new Date().toISOString(),
    };

    if (session.payment_intent) {
      updatePayload.stripe_payment_intent_id =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent.id;
    }

    const { error: updateError } = await adminClient
      .from('lifetime_purchases')
      .update(updatePayload)
      .eq('id', pendingPurchaseId);

    if (updateError) {
      console.error(
        'Failed to update lifetime purchase with Stripe session data:',
        updateError
      );
    }

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error) {
    if (pendingPurchaseId) {
      try {
        await adminClient
          .from('lifetime_purchases')
          .update({
            status: 'cancelled',
            reserved_expires_at: null,
          })
          .eq('id', pendingPurchaseId);
      } catch (releaseError) {
        console.error(
          'Failed to release lifetime slot after checkout error:',
          releaseError
        );
      }
    }

    console.error('Lifetime checkout session error:', error);
    return NextResponse.json(
      { error: 'Unable to create lifetime checkout session.' },
      { status: 500 },
    );
  }
}
