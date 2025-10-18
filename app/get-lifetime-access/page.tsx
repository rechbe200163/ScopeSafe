import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  LIFETIME_TIER_PRICING,
  MAX_LIFETIME_SLOTS,
  determineLifetimeTier,
  getLifetimeStripeProductId,
  remainingSlotsForTier,
  type LifetimeTier,
} from '@/lib/lifetime';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const EURO_SYMBOL = '\u20ac';

type LifetimePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LifetimeAccessPage({
  searchParams,
}: LifetimePageProps) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .not('lifetime_tier', 'is', null);

  const resolvedSearchParams: Record<string, string | string[] | undefined> =
    (searchParams ? await searchParams : undefined) ?? {};

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('Failed to determine authenticated user for lifetime page:', authError);
  }

  let currentUserTier: LifetimeTier | null = null;

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('lifetime_tier')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to fetch current user lifetime tier:', profileError);
    } else {
      currentUserTier = (profile?.lifetime_tier as LifetimeTier | null | undefined) ?? null;
    }
  }

  if (error) {
    console.error('Failed to fetch lifetime user count:', error);
  }

  const total = count ?? 0;
  const tier = determineLifetimeTier(total);

  if (tier === 'closed') {
    redirect('/');
  }

  const remaining = remainingSlotsForTier(total, tier);
  const price = LIFETIME_TIER_PRICING[tier];
  const stripeProductId = getLifetimeStripeProductId(tier);
  const canCheckout = Boolean(user) && !currentUserTier;

  const checkoutStatus =
    typeof resolvedSearchParams.checkout === 'string'
      ? resolvedSearchParams.checkout
      : null;

  const statusMessage =
    checkoutStatus === 'success'
      ? 'Thanks for locking in lifetime access! Check your inbox for the next steps.'
      : checkoutStatus === 'cancelled'
      ? 'Checkout was cancelled. You can try again anytime while spots remain.'
      : null;

  let promoCopy: ReactNode;
  switch (tier) {
    case 'early':
      promoCopy = (
        <>
          Super Early Supporter - <strong>{remaining}</strong> Plaetze
          verfuegbar!
        </>
      );
      break;
    case 'mid':
      promoCopy = (
        <>
          Early Bird - <strong>{remaining}</strong> Plaetze uebrig!
        </>
      );
      break;
    default:
      promoCopy = (
        <>
          Letzte Chance - nur <strong>{remaining}</strong> Lifetime Deals
          uebrig!
        </>
      );
      break;
  }

  const claimedPercentage = Math.min(
    100,
    Math.round((total / MAX_LIFETIME_SLOTS) * 100),
  );

  const priceLabel = `${EURO_SYMBOL}${price}`;

  return (
    <div className='min-h-screen bg-gradient-to-b from-background via-background to-muted'>
      <main className='mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-16'>
        <section className='space-y-8 rounded-3xl border bg-card p-10 shadow-sm'>
          {statusMessage && (
            <div className='rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary'>
              {statusMessage}
            </div>
          )}

          <header className='space-y-3 text-center sm:text-left'>
            <p className='text-sm font-medium uppercase tracking-wide text-primary'>
              Lifetime Access
            </p>
            <h1 className='text-4xl font-bold tracking-tight sm:text-5xl'>
              Lock ScopeSafe in for life - no monthly fees, ever.
            </h1>
            <p className='text-lg text-muted-foreground sm:text-xl'>
              We're offering a one-time lifetime deal for our first{' '}
              {MAX_LIFETIME_SLOTS} users. After that, ScopeSafe switches to
              monthly pricing.{' '}
              <strong>
                {total} of {MAX_LIFETIME_SLOTS} spots are already taken
              </strong>{' '}
              - act fast to lock in your lifetime access.
            </p>
          </header>

          <div className='space-y-6 rounded-2xl border border-primary/20 bg-primary/5 p-6'>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div className='space-y-2 text-center sm:text-left'>
                <p className='text-sm font-semibold uppercase tracking-wide text-primary/80'>
                  Aktueller Deal
                </p>
                <h2 className='text-3xl font-bold'>{promoCopy}</h2>
              </div>
              <div className='text-center sm:text-right'>
                <span className='text-5xl font-bold tracking-tight text-primary'>
                  {priceLabel}
                </span>
                <p className='text-sm font-medium text-primary/80'>
                  Einmalzahlung - Lifetime Access
                </p>
              </div>
            </div>

            <div>
              <div className='mb-2 flex items-center justify-between text-sm font-medium text-primary/80'>
                <span>{total} vergeben</span>
                <span>{MAX_LIFETIME_SLOTS - total} verfuegbar</span>
              </div>
              <div className='h-2 w-full overflow-hidden rounded-full bg-primary/10'>
                <div
                  className='h-full rounded-full bg-primary transition-[width] duration-300 ease-out'
                  style={{ width: `${claimedPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <p className='text-lg font-medium text-foreground'>
            Sichere dir Lifetime Access fuer ScopeSafe, inklusive allem, was
            kommt - keine Abogebuehren, keine Preiserhoehungen.
          </p>

          {canCheckout ? (
            <form
              action='/api/stripe/create-lifetime-checkout'
              method='POST'
              className='flex flex-col gap-4 sm:flex-row sm:items-center'
            >
              <Button
                type='submit'
                size='lg'
                className='w-full sm:w-auto'
                disabled={!stripeProductId}
              >
                {stripeProductId
                  ? `Get Lifetime Access for ${priceLabel}`
                  : 'Lifetime checkout not configured'}
              </Button>
              {!stripeProductId && (
                <p className='text-sm text-muted-foreground'>
                  Stripe product IDs for this tier are missing in the environment.
                </p>
              )}
            </form>
          ) : (
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
              {currentUserTier ? (
                <div className='w-full rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary sm:w-auto'>
                  Du hast bereits Lifetime Access (Tier: {currentUserTier}).
                </div>
              ) : (
                <>
                  <Button asChild size='lg' className='w-full sm:w-auto'>
                    <Link href='/auth/sign-up'>
                      Create account to claim Lifetime Access
                    </Link>
                  </Button>
                  <p className='text-sm text-muted-foreground'>
                    Schon registriert?{' '}
                    <Link
                      href='/auth/login'
                      className='text-primary underline underline-offset-4'
                    >
                      Anmelden
                    </Link>{' '}
                    und den Lifetime Deal sichern.
                  </p>
                </>
              )}
            </div>
          )}

          <ul className='space-y-3 text-sm text-muted-foreground'>
            <li>
              - Volle ScopeSafe-Funktionalitaet inklusive aller zukuenftigen
              Features.
            </li>
            <li>
              - Lifetime-Support &amp; Updates - du gehoerst zu den 150
              Beta-Investoren.
            </li>
            <li>
              - Fixer Preis - egal, wie sehr ScopeSafe waechst oder im Preis
              steigt.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
