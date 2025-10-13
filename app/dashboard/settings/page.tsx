'use client';

import type React from 'react';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  subscriptionPlans,
  type SubscriptionTier,
} from '@/lib/subscriptions/plans';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function formatStatusLabel(status?: string | null) {
  if (!status) return '';
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('100.00');
  const [subscriptionTier, setSubscriptionTier] =
    useState<SubscriptionTier>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(
    null
  );
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAt, setCancelAt] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [profileMessage, setProfileMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [subscriptionMessage, setSubscriptionMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [checkoutLoadingTier, setCheckoutLoadingTier] =
    useState<SubscriptionTier | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('users')
          .select(
            'name, company_name, hourly_rate, subscription_tier, subscription_status, current_period_end, cancel_at, stripe_customer_id, stripe_subscription_id'
          )
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setName(data.name || '');
          setCompanyName(data.company_name || '');
          setHourlyRate(data.hourly_rate?.toString() || '100.00');
          setSubscriptionTier(
            (data.subscription_tier as SubscriptionTier) || 'free'
          );
          setSubscriptionStatus(data.subscription_status || null);
          setCurrentPeriodEnd(data.current_period_end || null);
          setCancelAt(data.cancel_at || null);
          setStripeCustomerId(data.stripe_customer_id || null);
          setStripeSubscriptionId(data.stripe_subscription_id || null);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchProfile();
  }, [supabase]);

  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    if (!checkoutStatus) return;

    if (checkoutStatus === 'success') {
      setSubscriptionMessage({
        type: 'success',
        text: 'Subscription updated successfully.',
      });
    } else if (checkoutStatus === 'cancelled') {
      setSubscriptionMessage({
        type: 'error',
        text: 'Checkout was cancelled before completion.',
      });
    }

    // Remove the query param from the URL after displaying the message.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      window.history.replaceState(null, '', url.toString());
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setProfileMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('users')
        .update({
          name: name || null,
          company_name: companyName || null,
          hourly_rate: Number.parseFloat(hourlyRate),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfileMessage({
        type: 'success',
        text: 'Settings saved successfully!',
      });
    } catch (err) {
      setProfileMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckout = async (tier: SubscriptionTier) => {
    if (tier === 'free') return;

    setCheckoutLoadingTier(tier);
    setSubscriptionMessage(null);

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Unable to start checkout.');
      }

      window.location.href = data.url as string;
    } catch (err) {
      setSubscriptionMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Failed to start Stripe checkout session.',
      });
    } finally {
      setCheckoutLoadingTier(null);
    }
  };

  const handlePortal = async () => {
    if (isPortalLoading) return;
    setIsPortalLoading(true);
    setSubscriptionMessage(null);

    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Unable to open billing portal.');
      }

      window.location.href = data.url as string;
    } catch (err) {
      setSubscriptionMessage({
        type: 'error',
        text:
          err instanceof Error ? err.message : 'Failed to open billing portal.',
      });
    } finally {
      setIsPortalLoading(false);
    }
  };

  const planName = useMemo(() => {
    const plan = subscriptionPlans.find((p) => p.id === subscriptionTier);
    return plan?.name ?? 'Free';
  }, [subscriptionTier]);

  const isSubscriptionActive =
    subscriptionTier !== 'free' &&
    (subscriptionStatus ? ACTIVE_STATUSES.has(subscriptionStatus) : false);

  const formattedPeriodEnd = useMemo(() => {
    if (!currentPeriodEnd || !isSubscriptionActive) return null;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(currentPeriodEnd)
    );
  }, [currentPeriodEnd, isSubscriptionActive]);

  const formattedCancelAt = useMemo(() => {
    if (!cancelAt) return null;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(cancelAt)
    );
  }, [cancelAt]);

  const statusLabel =
    subscriptionTier !== 'free' && subscriptionStatus && !isSubscriptionActive
      ? formatStatusLabel(subscriptionStatus)
      : null;

  const subscriptionSummaryParts = [
    subscriptionTier === 'free'
      ? 'You are currently using the Free plan.'
      : `You are currently on the ${planName} plan.`,
    formattedPeriodEnd ? `Next renewal on ${formattedPeriodEnd}.` : null,
    formattedCancelAt
      ? `Cancellation scheduled for ${formattedCancelAt}.`
      : null,
    statusLabel ? `Status: ${statusLabel}.` : null,
  ].filter(Boolean);

  if (isFetching) {
    return (
      <div className='container mx-auto max-w-5xl space-y-8 p-6'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 w-48 rounded bg-muted' />
          <div className='h-4 w-64 rounded bg-muted' />
        </div>
      </div>
    );
  }

  const canManageBilling = Boolean(stripeCustomerId);
  const hasActiveSubscription =
    Boolean(stripeSubscriptionId) &&
    (subscriptionStatus ? ACTIVE_STATUSES.has(subscriptionStatus) : false);

  return (
    <div className='container mx-auto max-w-6xl space-y-8 p-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Settings</h1>
        <p className='text-muted-foreground'>
          Manage your account settings and preferences
        </p>
      </div>

      <div className='grid gap-8 lg:grid-cols-[1.2fr,1fr]'>
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your personal and business details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className='space-y-6'>
              <div className='space-y-2'>
                <Label htmlFor='name'>Full Name</Label>
                <Input
                  id='name'
                  placeholder='John Doe'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='company'>Company Name (Optional)</Label>
                <Input
                  id='company'
                  placeholder='Your Company LLC'
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='rate'>Hourly Rate ($)</Label>
                <Input
                  id='rate'
                  type='number'
                  step='0.01'
                  min='0'
                  placeholder='100.00'
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  required
                />
                <p className='text-xs text-muted-foreground'>
                  This rate will be used to calculate estimated costs for change
                  orders
                </p>
              </div>

              {profileMessage && (
                <div
                  className={cn(
                    'rounded-md p-3 text-sm',
                    profileMessage.type === 'success'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-destructive/10 text-destructive'
                  )}
                >
                  {profileMessage.text}
                </div>
              )}

              <Button type='submit' disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription & Billing</CardTitle>
            <CardDescription>
              Review your plan, billing status, and manage payment details
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              {subscriptionSummaryParts.map((line) => (
                <p key={line} className='text-sm text-muted-foreground'>
                  {line}
                </p>
              ))}
              {subscriptionTier !== 'free' && (
                <div className='flex items-center gap-2 pt-2'>
                  <Badge variant='secondary' className='text-xs'>
                    {isSubscriptionActive
                      ? 'Active'
                      : formatStatusLabel(subscriptionStatus)}
                  </Badge>
                  {hasActiveSubscription && formattedPeriodEnd && (
                    <span className='text-xs text-muted-foreground'>
                      Renews {formattedPeriodEnd}
                    </span>
                  )}
                </div>
              )}
            </div>

            {subscriptionMessage && (
              <div
                className={cn(
                  'rounded-md p-3 text-sm',
                  subscriptionMessage.type === 'success'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-destructive/10 text-destructive'
                )}
              >
                {subscriptionMessage.text}
              </div>
            )}

            <div className='flex flex-wrap gap-3'>
              {canManageBilling ? (
                <Button
                  variant='outline'
                  onClick={handlePortal}
                  disabled={isPortalLoading}
                >
                  {isPortalLoading
                    ? 'Opening portal...'
                    : 'Open Billing Portal'}
                </Button>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  Start a paid plan to unlock billing management.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className='space-y-6'>
        <div>
          <h2 className='text-2xl font-semibold'>Plans</h2>
          <p className='text-sm text-muted-foreground'>
            Choose the plan that best fits your workflow.
          </p>
        </div>

        <div className='grid gap-6 md:grid-cols-2 xl:grid-cols-3'>
          {subscriptionPlans
            .filter((plan) => plan.id !== 'business')
            .map((plan) => {
              const isCurrentPlan = subscriptionTier === plan.id;
              const isProcessing = checkoutLoadingTier === plan.id;

              let actionLabel = 'Select Plan';
              let actionDisabled = false;
              let actionVariant: 'default' | 'outline' | 'secondary' =
                isCurrentPlan ? 'default' : 'outline';
              let actionHandler: (() => void) | null = null;

              if (plan.id === 'free') {
                if (subscriptionTier === 'free') {
                  actionLabel = 'Current Plan';
                  actionDisabled = true;
                } else if (canManageBilling) {
                  actionLabel = 'Downgrade in Portal';
                  actionVariant = 'outline';
                  actionHandler = handlePortal;
                } else {
                  actionLabel = 'Contact Support';
                  actionDisabled = true;
                }
              } else {
                if (isCurrentPlan && isSubscriptionActive) {
                  actionLabel = 'Current Plan';
                  actionDisabled = true;
                } else {
                  actionHandler = () => handleCheckout(plan.id);
                  if (plan.id === 'pro') {
                    actionLabel = isProcessing
                      ? 'Redirecting...'
                      : 'Start Pro Trial';
                  } else {
                    actionLabel = isProcessing
                      ? 'Redirecting...'
                      : 'Upgrade to Business';
                  }
                  actionDisabled = isProcessing;
                }
              }

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    'flex h-full flex-col border transition-all relative',
                    isCurrentPlan ? 'border-primary shadow-lg' : 'border-border'
                  )}
                >
                  {plan.badge && (
                    <div className='absolute left-1/2 -translate-x-1/2 -top-4 z-10'>
                      <Badge className='uppercase text-xs px-4 py-1'>
                        {plan.badge}
                      </Badge>
                    </div>
                  )}
                  <CardHeader className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <CardTitle>{plan.name}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                      </div>
                    </div>
                    <div>
                      <span className='text-4xl font-bold'>
                        {plan.priceLabel}
                      </span>
                      <span className='ml-1 text-muted-foreground'>
                        /{plan.interval}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className='flex flex-1 flex-col justify-between space-y-6'>
                    <ul className='space-y-3 text-sm'>
                      {plan.features.map((feature) => (
                        <li
                          key={feature.label}
                          className='flex items-start gap-3 text-left'
                        >
                          {feature.included ? (
                            <Check className='mt-0.5 h-4 w-4 shrink-0 text-primary' />
                          ) : (
                            <X className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                          )}
                          <span
                            className={cn(
                              'text-sm',
                              feature.included
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {feature.label}
                            {feature.soon ? (
                              <span className='ml-1 text-xs uppercase text-muted-foreground'>
                                Coming Soon
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={actionVariant}
                      disabled={actionDisabled}
                      onClick={actionHandler || undefined}
                    >
                      {actionLabel}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      </section>
    </div>
  );
}
