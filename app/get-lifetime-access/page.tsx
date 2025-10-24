import type { ReactNode } from 'react';

import { LifetimeDashboardCta } from '@/components/lifetime-dashboard-cta';
import { Button } from '@/components/ui/button';
import {
  LIFETIME_TIER_PRICING,
  getLifetimeStripeProductId,
} from '@/lib/lifetime';
import {
  analyzeLifetimePurchases,
  isLifetimeTierKey,
  resolveUserLifetimeStatus,
} from '@/lib/lifetime/purchases';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowRight, Check, Clock, Shield, Sparkles, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

const EURO_SYMBOL = '\u20ac';
const WAITLIST_MAILTO =
  'mailto:hello@scopesafe.app?subject=ScopeSafe%20Lifetime%20Waitlist';
const PRO_MONTHLY_PRICE = 19;

type LifetimePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LifetimeAccessPage({
  searchParams,
}: LifetimePageProps) {
  const supabase = await createClient();

  const [
    { data: purchaseRows, error: purchaseError },
    { data: tierLimitRows, error: tierLimitError },
  ] = await Promise.all([
    supabase
      .from('lifetime_purchases')
      .select('id,tier,status,reserved_expires_at,user_id,created_at')
      .in('status', ['pending', 'paid']),
    supabase.from('lifetime_tier_limits').select('tier,max_slots'),
  ]);

  const resolvedSearchParams: Record<string, string | string[] | undefined> =
    (searchParams ? await searchParams : undefined) ?? {};

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const isSessionMissingError =
    authError &&
    typeof authError.message === 'string' &&
    authError.message.toLowerCase().includes('auth session missing');

  if (authError && !isSessionMissingError) {
    console.error(
      'Failed to determine authenticated user for lifetime page:',
      authError
    );
  }

  if (purchaseError) {
    console.error('Failed to load lifetime purchases:', purchaseError);
  }

  if (tierLimitError) {
    console.error('Failed to load lifetime tier limits:', tierLimitError);
  }

  const nowMs = Date.now();
  const { availability, activePurchases } =
    analyzeLifetimePurchases(
      Array.isArray(purchaseRows) ? purchaseRows : [],
      Array.isArray(tierLimitRows) ? tierLimitRows : [],
      nowMs
    );
  const userStatus = resolveUserLifetimeStatus(
    activePurchases,
    user?.id ?? null,
    nowMs
  );
  let currentUserTier = userStatus.tier;
  let currentUserTierStatus = userStatus.status;
  const {
    tier,
    activeTier,
    remainingInTier: remaining,
    effectiveMaxSlots,
    reservedSlots,
    availableSlots,
    claimedPercentage,
    totalPaid,
  } = availability;
  const isSoldOut = tier === 'closed';
  const price = activeTier ? LIFETIME_TIER_PRICING[activeTier] : null;
  const priceLabel = price ? `${EURO_SYMBOL}${price}` : '';
  const stripeProductId = activeTier
    ? getLifetimeStripeProductId(activeTier)
    : null;

  if (user && !currentUserTierStatus) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('lifetime_tier')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        'Failed to fetch current user lifetime tier:',
        profileError
      );
    } else {
      const legacyTier = profile?.lifetime_tier;
      if (legacyTier && isLifetimeTierKey(legacyTier)) {
        currentUserTier = legacyTier;
        currentUserTierStatus = 'paid';
      }
    }
  }

  const canCheckout =
    Boolean(activeTier) && Boolean(user) && !currentUserTierStatus;
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const metadataFullName =
    typeof metadata['full_name'] === 'string'
      ? (metadata['full_name'] as string).trim()
      : null;
  const metadataName =
    typeof metadata['name'] === 'string' ? (metadata['name'] as string).trim() : null;
  const metadataAvatarUrl =
    typeof metadata['avatar_url'] === 'string'
      ? (metadata['avatar_url'] as string).trim()
      : null;
  const metadataPicture =
    typeof metadata['picture'] === 'string'
      ? (metadata['picture'] as string).trim()
      : null;
  const lifetimeUserName =
    metadataFullName && metadataFullName.length > 0
      ? metadataFullName
      : metadataName && metadataName.length > 0
      ? metadataName
      : null;
  const lifetimeAvatarUrl =
    metadataAvatarUrl && metadataAvatarUrl.length > 0
      ? metadataAvatarUrl
      : metadataPicture && metadataPicture.length > 0
      ? metadataPicture
      : null;
  const isLifetimeMember = currentUserTierStatus === 'paid';
  const pendingReservationDisplay =
    currentUserTierStatus === 'pending' && userStatus.reservationExpiresAt
      ? new Date(userStatus.reservationExpiresAt).toLocaleString()
      : null;
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

  if (isSoldOut) {
    return (
      <div className='flex min-h-screen flex-col bg-background'>
        <LifetimeDashboardCta
          initialIsLifetimeUser={isLifetimeMember}
          userName={lifetimeUserName}
          userEmail={user?.email ?? null}
          avatarUrl={lifetimeAvatarUrl}
        />
        <main className='flex-1 bg-gradient-to-b from-background via-background to-muted/40'>
          <section className='px-6 py-16 sm:py-24'>
            <div className='mx-auto flex max-w-3xl flex-col gap-10'>
              {statusMessage && (
                <div className='rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm text-primary'>
                  {statusMessage}
                </div>
              )}

              <header className='space-y-4 text-center sm:text-left'>
                <p className='text-sm font-semibold uppercase tracking-wide text-primary'>
                  Lifetime Deal Update
                </p>
                <h1 className='text-4xl font-bold tracking-tight sm:text-5xl'>
                  The current lifetime batch is sold out.
                </h1>
                <p className='text-lg text-muted-foreground sm:text-xl'>
                  Thank you to the early adopters who jumped in. We cap each
                  lifetime wave so we can keep support
                  and product feedback manageable.
                </p>
              </header>

              <div className='grid gap-6 rounded-2xl border border-primary/20 bg-card/60 p-8 lg:grid-cols-3'>
                <div className='space-y-2'>
                  <p className='text-sm font-semibold uppercase tracking-wide text-primary/80'>
                    Claimed
                  </p>
                  <p className='text-3xl font-bold text-primary'>
                    {reservedSlots} / {effectiveMaxSlots}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    Every slot in this batch has been reserved.
                  </p>
                </div>
                <div className='space-y-2'>
                  <p className='text-sm font-semibold uppercase tracking-wide text-primary/80'>
                    Next chance
                  </p>
                  <p className='text-3xl font-bold text-primary'>Join waitlist</p>
                  <p className='text-sm text-muted-foreground'>
                    Add your email and we will notify you before the next drop.
                  </p>
                </div>
                <div className='space-y-2'>
                  <p className='text-sm font-semibold uppercase tracking-wide text-primary/80'>
                    What now
                  </p>
                  <p className='text-3xl font-bold text-primary'>
                    Start your free trial
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    ScopeSafe Pro includes a 14 day free trial so you can ship
                    change orders right away.
                  </p>
                </div>
              </div>

              <section className='rounded-2xl border border-muted bg-card p-8 shadow-sm'>
                <div className='grid gap-8 lg:grid-cols-2'>
                  <div className='space-y-4'>
                    <p className='text-sm font-semibold uppercase tracking-wide text-primary'>
                      Standard Pricing
                    </p>
                    <h2 className='text-3xl font-bold text-foreground'>
                      ScopeSafe Pro Plan
                    </h2>
                    <p className='text-muted-foreground'>
                      Keep your projects on track with AI assisted scope
                      control, polished change orders, and upcoming automation
                      features.
                    </p>
                    <div className='flex flex-wrap items-baseline gap-2'>
                      <span className='text-5xl font-bold text-primary'>
                        {EURO_SYMBOL}
                        {PRO_MONTHLY_PRICE}
                      </span>
                      <span className='text-sm font-medium text-muted-foreground'>
                        per month after free trial
                      </span>
                    </div>
                    <ul className='space-y-2 text-sm text-muted-foreground'>
                      <li className='flex items-start gap-2'>
                        <Check className='mt-1 h-4 w-4 text-primary' />
                        <span>Unlimited change orders and PDF exports</span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <Check className='mt-1 h-4 w-4 text-primary' />
                        <span>Client ready emails with one click</span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <Check className='mt-1 h-4 w-4 text-primary' />
                        <span>Priority roadmap input from paying users</span>
                      </li>
                    </ul>
                  </div>
                  <div className='flex flex-col justify-between gap-6 rounded-xl border border-primary/20 bg-primary/5 p-6'>
                    <div className='space-y-3'>
                      <h3 className='text-xl font-semibold text-foreground'>
                        Try ScopeSafe Pro for free
                      </h3>
                      <p className='text-sm text-muted-foreground'>
                        You can test the full workflow, invite collaborators,
                        and decide later if you keep the subscription.
                      </p>
                    </div>
                    <Button asChild size='lg' className='w-full sm:w-auto'>
                      <Link href='/auth/sign-up'>Start 14 day free trial</Link>
                    </Button>
                    <p className='text-xs text-muted-foreground'>
                      No credit card? Reach out to support@scopesafe.app and we
                      will activate the trial manually.
                    </p>
                  </div>
                </div>
              </section>

              <section className='rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center sm:text-left'>
                <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='space-y-3'>
                    <h2 className='text-2xl font-semibold text-foreground'>
                      Want in on the next lifetime batch?
                    </h2>
                    <p className='text-sm text-muted-foreground'>
                      Add yourself to the interest list and we will let you know
                      before the next limited batch goes live.
                    </p>
                  </div>
                  <Button asChild size='lg' variant='outline'>
                    <Link href={WAITLIST_MAILTO}>
                      Join the waitlist
                      <ArrowRight className='ml-2 h-4 w-4' />
                    </Link>
                  </Button>
                </div>
              </section>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const safeTier = activeTier ?? 'final';

  let promoCopy: ReactNode;
  switch (safeTier) {
    case 'early':
      promoCopy = (
        <>
          Super Early Supporter -- <strong>{remaining}</strong> spots available
        </>
      );
      break;
    case 'mid':
      promoCopy = (
        <>
          Early Bird -- <strong>{remaining}</strong> spots left
        </>
      );
      break;
    default:
      promoCopy = (
        <>
          Final stretch -- only <strong>{remaining}</strong> lifetime deals left
        </>
      );
      break;
  }

  const lifetimeHighlights = [
    'Full ScopeSafe feature set for every project you run',
    'Priority input on roadmap and direct line to the founder',
    'Lifetime updates and support without renewal surprises',
  ];

  const lifetimeComparison = [
    {
      label: 'One payment, lifetime access',
      lifetime: `Pay ${priceLabel} once`,
      monthly: `Pay ${EURO_SYMBOL}${PRO_MONTHLY_PRICE} every month`,
    },
    {
      label: 'Future feature drops',
      lifetime: 'Included automatically',
      monthly: 'Included while subscribed',
    },
    {
      label: 'Change order credits',
      lifetime: 'Unlimited, forever',
      monthly: 'Unlimited during active subscription',
    },
  ];

  return (
    <div className='flex min-h-screen flex-col bg-background'>
      <LifetimeDashboardCta
        initialIsLifetimeUser={isLifetimeMember}
        userName={lifetimeUserName}
        userEmail={user?.email ?? null}
        avatarUrl={lifetimeAvatarUrl}
      />
      <main className='flex-1 bg-gradient-to-b from-background via-background to-muted/40'>
        <section className='px-6 py-16 sm:py-24'>
          <div className='mx-auto flex max-w-5xl flex-col gap-12'>
            {statusMessage && (
              <div className='rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm text-primary'>
                {statusMessage}
              </div>
            )}

            <header className='space-y-4 text-center sm:text-left'>
              <p className='text-sm font-medium uppercase tracking-wide text-primary'>
                Lifetime Access
              </p>
              <h1 className='text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl'>
                Lock ScopeSafe in for life -- no monthly fees, ever.
              </h1>
              <p className='text-lg text-muted-foreground sm:text-xl'>
                We opened a limited lifetime batch for the first{' '}
                {effectiveMaxSlots} makers. After that ScopeSafe moves to the
                standard Pro pricing.{' '}
                <strong>
                  {reservedSlots} of {effectiveMaxSlots} spots are already taken
                </strong>{' '}
                so this wave will close soon.
              </p>
            </header>

            <div className='space-y-6 rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm'>
              <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                <div className='space-y-2 text-center sm:text-left'>
                  <p className='text-sm font-semibold uppercase tracking-wide text-primary/80'>
                    Current Deal
                  </p>
                  <h2 className='text-3xl font-bold'>{promoCopy}</h2>
                </div>
                <div className='text-center sm:text-right'>
                  <span className='text-5xl font-bold tracking-tight text-primary'>
                    {priceLabel}
                  </span>
                  <p className='text-sm font-medium text-primary/80'>
                    One-time payment -- lifetime access
                  </p>
                </div>
              </div>

              <div>
                <div className='mb-2 flex items-center justify-between text-sm font-medium text-primary/80'>
                <span>{reservedSlots} reserved</span>
                  <span>{availableSlots} available</span>
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
              Secure lifetime access to ScopeSafe, including everything to come
              -- no subscription fees, no price increases.
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
                    ? `Get lifetime access for ${priceLabel}`
                    : 'Lifetime checkout not configured'}
                </Button>
                {!stripeProductId && (
                  <p className='text-sm text-muted-foreground'>
                    Stripe product IDs for this tier are missing in the
                    environment.
                  </p>
                )}
              </form>
            ) : (
              <div className='flex flex-col gap-4 rounded-xl border border-muted bg-card/80 p-6 sm:flex-row sm:items-center sm:justify-between'>
                {currentUserTierStatus === 'paid' && currentUserTier ? (
                  <div className='w-full rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary sm:w-auto'>
                    You already have lifetime access (tier: {currentUserTier}).
                  </div>
                ) : currentUserTierStatus === 'pending' && currentUserTier ? (
                  <div className='w-full rounded-lg border border-amber-300 bg-amber-100/40 px-4 py-3 text-sm font-medium text-amber-900 sm:w-auto'>
                    Your lifetime checkout is still pending (tier: {currentUserTier}
                    ). Complete the payment while the reservation is active
                    {pendingReservationDisplay
                      ? ` — hold expires ${pendingReservationDisplay}.`
                      : '.'}
                  </div>
                ) : (
                  <>
                    <div className='space-y-3 text-sm text-muted-foreground sm:max-w-sm'>
                      <p className='font-semibold text-foreground'>
                        Create your account, then checkout:
                      </p>
                      <p>
                        Signing up takes under a minute. You can use email or
                        continue with Google or Apple on the next screen.
                      </p>
                    </div>
                    <div className='flex w-full flex-col gap-3 sm:w-auto sm:flex-row'>
                      <Button asChild size='lg' className='w-full sm:w-auto'>
                        <Link href='/auth/sign-up?next=/get-lifetime-access'>
                          Create account to claim lifetime access
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size='lg'
                        variant='outline'
                        className='w-full sm:w-auto'
                      >
                        <Link href='/auth/login?next=/get-lifetime-access'>
                          Already registered? Log in
                        </Link>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className='grid gap-6 lg:grid-cols-2'>
              <div className='space-y-4 rounded-2xl border border-muted bg-card/70 p-6'>
                <div className='flex items-center gap-3'>
                  <Sparkles className='h-5 w-5 text-primary' />
                  <h3 className='text-lg font-semibold'>Mini ROI check</h3>
                </div>
                <p className='text-sm text-muted-foreground'>
                  If ScopeSafe helps you protect just two hours of free work per
                  month, the lifetime deal pays for itself in less than one
                  billing cycle compared with the Pro plan.
                </p>
                <p className='text-sm text-muted-foreground'>
                  That is before you factor in the client confidence that comes
                  from crisp, professional change orders.
                </p>
              </div>
              <div className='space-y-4 rounded-2xl border border-muted bg-card/70 p-6'>
                <div className='flex items-center gap-3'>
                  <Clock className='h-5 w-5 text-primary' />
                  <h3 className='text-lg font-semibold'>
                    Risk-free for 14 days
                  </h3>
                </div>
                <p className='text-sm text-muted-foreground'>
                  Try ScopeSafe with real client requests. If it is not a fit,
                  reply to your receipt within 14 days and we will refund you.
                </p>
                <p className='text-sm text-muted-foreground'>
                  No awkward questions -- we prefer you stay happy and tell us
                  what to improve.
                </p>
              </div>
            </div>

            <div className='rounded-2xl border border-primary/30 bg-primary/5 p-6'>
              <h3 className='mb-4 text-xl font-semibold'>
                Lifetime vs monthly at a glance
              </h3>
              <div className='grid gap-6 md:grid-cols-2'>
                {lifetimeComparison.map((item) => (
                  <div key={item.label} className='rounded-xl border bg-card p-5'>
                    <p className='mb-3 text-sm font-semibold uppercase tracking-wide text-primary/70'>
                      {item.label}
                    </p>
                    <div className='space-y-3 text-sm'>
                      <div className='flex items-start gap-2'>
                        <Check className='mt-0.5 h-4 w-4 text-primary' />
                        <span className='font-medium text-foreground'>
                          Lifetime: {item.lifetime}
                        </span>
                      </div>
                      <div className='flex items-start gap-2 text-muted-foreground'>
                        <ArrowRight className='mt-0.5 h-4 w-4 text-muted-foreground' />
                        <span>Monthly: {item.monthly}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className='grid gap-6 lg:grid-cols-[1.2fr_1fr]'>
              <div className='space-y-4 rounded-2xl border border-muted bg-card/70 p-6'>
                <div className='flex items-center gap-3'>
                  <Shield className='h-5 w-5 text-primary' />
                  <h3 className='text-lg font-semibold'>
                    Transparent about scarcity
                  </h3>
                </div>
                <p className='text-sm text-muted-foreground'>
                  Lifetime slots stay capped so we can ship fast, answer every
                  question, and incorporate feedback without drowning the team.
                  No fake countdowns -- just a hard ceiling to keep quality
                  high.
                </p>
                <p className='text-sm text-muted-foreground'>
                  Once the {effectiveMaxSlots} spots are gone we move back to
                  monthly billing. Join now to lock in the best deal we will
                  ever run.
                </p>
              </div>
              <div className='space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-6'>
                <div className='flex items-center gap-3'>
                  <Users className='h-5 w-5 text-primary' />
                  <h3 className='text-lg font-semibold'>Early adopter love</h3>
                </div>
                <p className='text-sm text-muted-foreground'>
                  {totalPaid > 0 ? (
                    <>
                      {totalPaid} freelancers already secured lifetime access and
                      are using ScopeSafe to set boundaries without losing
                      rapport.
                    </>
                  ) : (
                    'You could be among the very first founders to shape ScopeSafe.'
                  )}
                </p>
                <ul className='space-y-2 text-sm text-muted-foreground'>
                  <li>
                    "My client updates finally read like policies, not pleas."
                  </li>
                  <li>"The AI summary alone saved me an entire afternoon."</li>
                  <li>"Clients sign off faster because the pricing feels fair."</li>
                </ul>
              </div>
            </div>

            <div className='rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center text-sm text-muted-foreground sm:text-left'>
              Slots are limited so ScopeSafe can keep delivering personal
              support and fast product improvements. When this batch closes the
              page will switch to the standard pricing section.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
