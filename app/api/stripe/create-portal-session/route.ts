import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe';
import { getPortalReturnUrl } from '@/lib/subscriptions/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
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
      console.error('Stripe portal auth error:', authError);
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Stripe portal profile error:', profileError);
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        {
          error:
            'No Stripe customer found. Start a subscription before accessing the billing portal.',
        },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: getPortalReturnUrl(),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe portal session error:', error);
    return NextResponse.json(
      { error: 'Unable to create billing portal session.' },
      { status: 500 }
    );
  }
}
