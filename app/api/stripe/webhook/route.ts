import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import type { LifetimeTier } from '@/lib/lifetime';
import type { LifetimePurchaseStatus } from '@/lib/lifetime/purchases';
import { stripe } from '@/lib/stripe';
import { resolveTierFromProductId } from '@/lib/subscriptions/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
type LifetimeCheckoutTier = Exclude<LifetimeTier, 'closed'>;
const LIFETIME_CHECKOUT_TIERS: LifetimeCheckoutTier[] = [
  'early',
  'mid',
  'final',
];
const LIFETIME_TIER_ORDER = new Map<LifetimeCheckoutTier, number>([
  ['early', 0],
  ['mid', 1],
  ['final', 2],
]);

function toIso(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
}

async function upsertCustomerLink({
  supabaseUserId,
  customerId,
}: {
  supabaseUserId: string;
  customerId: string;
}) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', supabaseUserId);

    if (error) {
      console.error('Failed to link Stripe customer to user:', error);
    }
  } catch (error) {
    console.error('Supabase admin client error while linking customer:', error);
  }
}

async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
  eventType: Stripe.Event.Type
) {
  try {
    const adminClient = createAdminClient();
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    const subscriptionItem = subscription.items.data[0];
    const priceId =
      subscriptionItem?.price?.id ?? subscriptionItem?.plan?.id ?? null;
    const productRef =
      subscriptionItem?.price?.product ??
      subscriptionItem?.plan?.product ??
      null;
    const productId =
      typeof productRef === 'string'
        ? productRef
        : productRef && typeof productRef === 'object'
        ? (productRef as Stripe.Product).id
        : null;
    const tier = resolveTierFromProductId(productId);
    let customerMetadataSupabaseUserId: string | null = null;
    if (
      subscription.customer &&
      typeof subscription.customer === 'object' &&
      !('deleted' in subscription.customer)
    ) {
      customerMetadataSupabaseUserId =
        (subscription.customer.metadata?.supabaseUserId as
          | string
          | undefined) ?? null;
    }

    const supabaseUserId =
      subscription.metadata?.supabaseUserId || customerMetadataSupabaseUserId;

    const itemCurrentPeriodEnd = subscriptionItem?.current_period_end ?? null;

    const cancelled =
      eventType === 'customer.subscription.deleted' ||
      subscription.status === 'canceled' ||
      subscription.status === 'incomplete_expired';

    const updates: Record<string, unknown> = {
      stripe_customer_id: customerId,
      stripe_subscription_id: cancelled ? null : subscription.id,
      stripe_price_id: cancelled ? null : priceId,
      subscription_status: cancelled ? 'free' : subscription.status,
      cancel_at: subscription.cancel_at ? toIso(subscription.cancel_at) : null,
      current_period_end: itemCurrentPeriodEnd
        ? toIso(itemCurrentPeriodEnd)
        : null,
    };

    if (tier && !cancelled) {
      updates.subscription_tier = tier;
    }

    if (cancelled) {
      updates.subscription_tier = 'free';
      updates.cancel_at = null;
    }

    let query = adminClient.from('users').update(updates);

    if (supabaseUserId) {
      query = query.eq('id', supabaseUserId);
      console.log(`Updating subscription for user ${supabaseUserId}`);
    } else {
      query = query.eq('stripe_customer_id', customerId);
    }

    const { error } = await query;
    if (error) {
      console.error('Stripe webhook subscription update error:', error);
    }
  } catch (error) {
    console.error('Stripe webhook subscription handler failure:', error);
  }
}

function isLifetimeCheckoutTier(value: unknown): value is LifetimeCheckoutTier {
  return (
    typeof value === 'string' &&
    LIFETIME_CHECKOUT_TIERS.includes(value as LifetimeCheckoutTier)
  );
}

function resolvePaymentIntentId(
  session: Stripe.Checkout.Session
): string | null {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) return null;
  if (typeof paymentIntent === 'string') return paymentIntent;
  if (typeof paymentIntent === 'object' && 'id' in paymentIntent) {
    return paymentIntent.id ?? null;
  }
  return null;
}

async function updateLifetimePurchaseStatusFromSession(
  session: Stripe.Checkout.Session,
  status: LifetimePurchaseStatus
) {
  const purchaseId =
    (session.metadata?.lifetimePurchaseId as string | undefined) ?? null;
  const adminClient = createAdminClient();
  const updates: Record<string, unknown> = {
    status,
    reserved_expires_at: null,
    updated_at: new Date().toISOString(),
  };

  const paymentIntentId = resolvePaymentIntentId(session);
  if (paymentIntentId) {
    updates.stripe_payment_intent_id = paymentIntentId;
  }

  updates.stripe_session_id = session.id;

  let query = adminClient.from('lifetime_purchases').update(updates);

  if (purchaseId) {
    query = query.eq('id', purchaseId);
  } else {
    query = query.eq('stripe_session_id', session.id);
  }

  const { error } = await query;
  if (error) {
    console.error(
      `Failed to update lifetime purchase status to ${status}:`,
      error
    );
  }
}

async function upsertLifetimeUserFromSession(session: Stripe.Checkout.Session) {
  if (session.mode !== 'payment' || session.payment_status !== 'paid') return;

  console.log('Processing lifetime checkout session:', session.id);

  const tierValue = session.metadata?.lifetimeTier;
  if (!isLifetimeCheckoutTier(tierValue)) return;

  try {
    const adminClient = createAdminClient();
    const supabaseUserId =
      (typeof session.client_reference_id === 'string'
        ? session.client_reference_id
        : null) ||
      (session.metadata?.supabaseUserId as string | undefined) ||
      null;
    const normalizedEmail =
      (
        session.customer_details?.email ??
        session.customer_email ??
        null
      )?.toLowerCase() ?? null;

    const paymentIntentId = resolvePaymentIntentId(session);

    const purchaseUpdates: Record<string, unknown> = {
      status: 'paid',
      reserved_expires_at: null,
      stripe_session_id: session.id,
      updated_at: new Date().toISOString(),
    };

    if (paymentIntentId) {
      purchaseUpdates.stripe_payment_intent_id = paymentIntentId;
    }

    if (supabaseUserId) {
      purchaseUpdates.user_id = supabaseUserId;
    }

    if (normalizedEmail) {
      purchaseUpdates.email = normalizedEmail;
    }

    const purchaseId =
      (session.metadata?.lifetimePurchaseId as string | undefined) ?? null;

    if (purchaseId) {
      const { error: purchaseUpdateError } = await adminClient
        .from('lifetime_purchases')
        .update(purchaseUpdates)
        .eq('id', purchaseId);
      console.log('Updating lifetime purchase', purchaseId, purchaseUpdates);

      if (purchaseUpdateError) {
        console.error(
          'Failed to update lifetime purchase after payment:',
          purchaseUpdateError
        );
      }
    } else {
      console.warn(
        `Lifetime checkout session ${session.id} missing purchase metadata. Falling back to session lookup.`
      );
      const { error: purchaseUpdateError } = await adminClient
        .from('lifetime_purchases')
        .update(purchaseUpdates)
        .eq('stripe_session_id', session.id);

      if (purchaseUpdateError) {
        console.error(
          'Failed to update lifetime purchase using session id:',
          purchaseUpdateError
        );
      }
    }

    if (!supabaseUserId && !normalizedEmail) {
      console.error(
        'Lifetime checkout completed without user identifiers. Session:',
        session.id
      );
      return;
    }

    let userQuery = adminClient
      .from('users')
      .select('id, lifetime_tier')
      .limit(1);

    if (supabaseUserId) {
      userQuery = userQuery.eq('id', supabaseUserId);
    } else if (normalizedEmail) {
      userQuery = userQuery.eq('email', normalizedEmail);
    }

    const { data: userRecord, error: fetchError } =
      await userQuery.maybeSingle();

    if (fetchError) {
      console.error('Failed to locate user for lifetime checkout:', fetchError);
      return;
    }

    if (!userRecord) {
      console.warn(
        supabaseUserId
          ? `Lifetime checkout completed for user ${supabaseUserId}, but no matching user record was found.`
          : `Lifetime checkout completed for ${normalizedEmail}, but no matching user record was found.`
      );
      return;
    }

    const currentTier = userRecord.lifetime_tier as
      | LifetimeCheckoutTier
      | null
      | undefined;

    const currentRank = currentTier
      ? LIFETIME_TIER_ORDER.get(currentTier) ?? -1
      : -1;
    const nextRank = LIFETIME_TIER_ORDER.get(tierValue) ?? -1;

    if (currentRank >= nextRank) {
      return;
    }

    const { error: updateError } = await adminClient
      .from('users')
      .update({ lifetime_tier: tierValue })
      .eq('id', userRecord.id);

    if (updateError) {
      console.error('Failed to persist lifetime tier on user:', updateError);
    }
  } catch (error) {
    console.error(
      'Supabase admin client error while recording lifetime tier:',
      error
    );
  }
}

export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    console.error('Stripe webhook invoked without configuration.');
    return NextResponse.json(
      { error: 'Stripe webhook misconfigured.' },
      { status: 500 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing Stripe-Signature header.' },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('Processing checkout.session.completed event');
        const session = event.data.object as Stripe.Checkout.Session;
        const supabaseUserId =
          session.client_reference_id ||
          (session.metadata?.supabaseUserId as string | undefined);
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id ?? null;
        if (supabaseUserId && customerId) {
          await upsertCustomerLink({
            supabaseUserId,
            customerId,
          });
        }
        await upsertLifetimeUserFromSession(session);
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await updateLifetimePurchaseStatusFromSession(session, 'expired');
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await updateLifetimePurchaseStatusFromSession(session, 'cancelled');
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionEvent(subscription, event.type);
        break;
      }

      default:
        // No-op for unhandled events but we log for visibility.
        console.debug(`Unhandled Stripe webhook event: ${event.type}`);
        break;
    }
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failure.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
