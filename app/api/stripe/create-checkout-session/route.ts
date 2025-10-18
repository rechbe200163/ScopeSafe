import { NextResponse } from 'next/server';

import { getActivePriceIdForProduct, stripe } from '@/lib/stripe';
import type { SubscriptionTier } from '@/lib/subscriptions/plans';
import {
  getCancelUrl,
  getStripeProductId,
  getSuccessUrl,
} from '@/lib/subscriptions/server';
import { createClient } from '@/lib/supabase/server';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);
const TRIAL_DAYS: Partial<Record<SubscriptionTier, number>> = {
  pro: 3,
};

function normalizeTier(value: unknown): SubscriptionTier | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'pro' || normalized === 'business') {
    return normalized;
  }
  return null;
}

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured on the server.' },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Stripe checkout auth error:', authError);
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tier: requestedTier } = await request.json();
    const tier = normalizeTier(requestedTier);

    if (!tier) {
      return NextResponse.json(
        { error: 'Unsupported subscription tier requested.' },
        { status: 400 }
      );
    }

    const productId = getStripeProductId(tier);
    if (!productId) {
      return NextResponse.json(
        { error: 'Stripe product not configured for this tier.' },
        { status: 500 }
      );
    }

    const priceId = await getActivePriceIdForProduct(productId);

    if (!priceId) {
      return NextResponse.json(
        { error: 'Unable to resolve Stripe price for this tier.' },
        { status: 500 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(
        'id, email, name, company_name, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_tier'
      )
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Stripe checkout profile error:', profileError);
      return NextResponse.json(
        { error: 'Unable to load profile information.' },
        { status: 500 }
      );
    }

    if (
      profile.stripe_subscription_id &&
      profile.subscription_status &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(profile.subscription_status)
    ) {
      return NextResponse.json(
        {
          error:
            'There is already an active subscription. Manage changes via the billing portal.',
        },
        { status: 409 }
      );
    }

    let stripeCustomerId = profile.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: profile.name ?? undefined,
        metadata: {
          supabaseUserId: user.id,
          companyName: profile.company_name ?? undefined,
        },
      });
      stripeCustomerId = customer.id;

      const { error: updateError } = await supabase
        .from('users')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to persist Stripe customer id:', updateError);
      }
    } else {
      await stripe.customers.update(stripeCustomerId, {
        metadata: {
          ...(profile.subscription_tier
            ? { currentTier: profile.subscription_tier }
            : {}),
          supabaseUserId: user.id,
        },
        name: profile.name ?? undefined,
      });
    }

    const trialPeriodDays = TRIAL_DAYS[tier];

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: getSuccessUrl(),
      cancel_url: getCancelUrl(),
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: {
        supabaseUserId: user.id,
        subscriptionTier: tier,
      },
      subscription_data: {
        metadata: {
          supabaseUserId: user.id,
          subscriptionTier: tier,
        },
        trial_period_days: trialPeriodDays,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout session error:', error);
    return NextResponse.json(
      { error: 'Unable to create Stripe checkout session.' },
      { status: 500 }
    );
  }
}
