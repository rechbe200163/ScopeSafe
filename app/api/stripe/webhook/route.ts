import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { stripe } from '@/lib/stripe';
import { resolveTierFromProductId } from '@/lib/subscriptions/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
    const supabaseUserId =
      subscription.metadata?.supabaseUserId ||
      (typeof subscription.customer === 'object'
        ? subscription.customer.metadata?.supabaseUserId
        : null);

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
      current_period_end: toIso(subscription.current_period_end),
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
