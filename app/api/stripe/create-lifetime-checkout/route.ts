import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { determineLifetimeTier, getLifetimeStripeProductId, LifetimeTier } from '@/lib/lifetime';
import { getActivePriceIdForProduct, stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

    if (profile.lifetime_tier) {
      return NextResponse.json(
        { error: 'Lifetime access is already active on this account.' },
        { status: 409 },
      );
    }

    const adminClient = createAdminClient();
    const { count, error } = await adminClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .not('lifetime_tier', 'is', null);

    if (error) {
      console.error('Failed to count lifetime users:', error);
      return NextResponse.json(
        { error: 'Unable to verify lifetime availability.' },
        { status: 500 },
      );
    }

    const total = count ?? 0;
    const tier = determineLifetimeTier(total);

    if (tier === 'closed') {
      return NextResponse.json(
        { error: 'The lifetime offer is sold out.' },
        { status: 409 },
      );
    }

    const productId = getLifetimeStripeProductId(tier);

    if (!productId) {
      console.error(`Stripe product not configured for tier "${tier}".`);
      return NextResponse.json(
        { error: 'Stripe is not configured for this lifetime tier.' },
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

    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: getSuccessUrl(tier),
      cancel_url: getCancelUrl(tier),
      metadata: {
        lifetimeTier: tier,
        supabaseUserId: user.id,
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
      return NextResponse.json(
        { error: 'Stripe did not return a checkout URL.' },
        { status: 500 },
      );
    }

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error) {
    console.error('Lifetime checkout session error:', error);
    return NextResponse.json(
      { error: 'Unable to create lifetime checkout session.' },
      { status: 500 },
    );
  }
}
