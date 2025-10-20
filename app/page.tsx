import { Button } from '@/components/ui/button';
import { analyzeLifetimePurchases } from '@/lib/lifetime/purchases';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Shield, Zap, FileText, TrendingUp, Check, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
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

  if (purchaseError) {
    console.error('Failed to load lifetime purchases for home page:', purchaseError);
  }

  if (tierLimitError) {
    console.error('Failed to load lifetime tier limits for home page:', tierLimitError);
  }

  const { availability } = analyzeLifetimePurchases(
    Array.isArray(purchaseRows) ? purchaseRows : [],
    Array.isArray(tierLimitRows) ? tierLimitRows : [],
    Date.now()
  );

  if (availability.tier !== 'closed') {
    redirect('/get-lifetime-access');
  }

  return (
    <div className='flex min-h-screen flex-col'>
      {/* Hero Section */}
      <section className='flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted px-6 py-20 text-center'>
        <div className='mx-auto max-w-4xl space-y-8'>
          <div className='inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary'>
            <Zap className='h-4 w-4' />
            AI-Powered Change Order Management
          </div>

          <h1 className='text-balance text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl'>
            Stop Scope Creep in Its Tracks
          </h1>

          <p className='mx-auto max-w-2xl text-pretty text-xl font-semibold text-foreground sm:text-2xl'>
            Say no to free work — politely
          </p>

          <p className='mx-auto max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl'>
            ScopeSafe helps freelancers and agencies professionally handle
            out-of-scope requests with AI-powered analysis, instant estimates,
            and polished change orders.
          </p>

          <div className='flex flex-col gap-4 sm:flex-row sm:justify-center'>
            <Button asChild size='lg' className='text-lg'>
              <Link href='/auth/sign-up'>Get Started Free</Link>
            </Button>
            <Button
              asChild
              size='lg'
              variant='outline'
              className='text-lg bg-transparent'
            >
              <Link href='/auth/login'>Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className='border-t bg-muted/50 px-6 py-20'>
        <div className='mx-auto max-w-6xl'>
          <h2 className='mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl'>
            Everything you need to protect your scope
          </h2>

          <div className='grid gap-8 sm:grid-cols-2 lg:grid-cols-3'>
            <div className='flex flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
                <Shield className='h-6 w-6 text-primary' />
              </div>
              <h3 className='text-xl font-semibold'>Smart Analysis</h3>
              <p className='text-sm text-muted-foreground'>
                AI analyzes client requests to determine if they&apos;re in or
                out of scope automatically.
              </p>
            </div>

            <div className='flex flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
                <TrendingUp className='h-6 w-6 text-primary' />
              </div>
              <h3 className='text-xl font-semibold'>Instant Estimates</h3>
              <p className='text-sm text-muted-foreground'>
                Get accurate time and cost estimates based on your hourly rate
                and project context.
              </p>
            </div>

            <div className='flex flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
                <FileText className='h-6 w-6 text-primary' />
              </div>
              <h3 className='text-xl font-semibold'>Professional PDFs</h3>
              <p className='text-sm text-muted-foreground'>
                Generate polished change order PDFs with one click to send to
                your clients.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className='border-t px-6 py-20'>
        <div className='mx-auto max-w-6xl'>
          <div className='mb-12 text-center'>
            <h2 className='mb-4 text-3xl font-bold tracking-tight sm:text-4xl'>
              Simple, transparent pricing
            </h2>
            <p className='text-lg text-muted-foreground'>
              Choose the plan that fits your needs
            </p>
          </div>

          <div className='grid gap-8 lg:grid-cols-3'>
            {/* Free Plan */}
            <div className='flex flex-col rounded-lg border bg-card p-8'>
              <div className='mb-6'>
                <h3 className='mb-2 text-2xl font-bold'>Free</h3>
                <div className='mb-4'>
                  <span className='text-4xl font-bold'>€0</span>
                  <span className='text-muted-foreground'>/month</span>
                </div>
                <p className='text-sm text-muted-foreground'>
                  Perfect for trying out ScopeSafe
                </p>
              </div>

              <ul className='mb-8 flex-1 space-y-3'>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>
                    <strong>3 change orders</strong> per month
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>AI-powered request analysis</span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>Basic PDF generation</span>
                </li>
                <li className='flex items-start gap-3'>
                  <div className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30'>
                    <span className='text-xs font-bold text-amber-600 dark:text-amber-400'>
                      !
                    </span>
                  </div>
                  <span className='text-sm text-amber-600 dark:text-amber-400'>
                    <strong>Watermarks on PDFs</strong>
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <X className='h-5 w-5 shrink-0 text-muted-foreground' />
                  <span className='text-sm text-muted-foreground'>
                    No email automation
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <X className='h-5 w-5 shrink-0 text-muted-foreground' />
                  <span className='text-sm text-muted-foreground'>
                    No custom branding
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <X className='h-5 w-5 shrink-0 text-muted-foreground' />
                  <span className='text-sm text-muted-foreground'>
                    No custom templates
                  </span>
                </li>
              </ul>

              <Button
                asChild
                variant='outline'
                size='lg'
                className='w-full bg-transparent'
              >
                <Link href='/auth/sign-up'>Get Started</Link>
              </Button>
            </div>

            {/* Pro Plan */}
            <div className='relative flex flex-col rounded-lg border-2 border-primary bg-card p-8 shadow-lg'>
              <div className='absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-semibold text-primary-foreground'>
                Most Popular
              </div>

              <div className='mb-6'>
                <h3 className='mb-2 text-2xl font-bold'>Pro</h3>
                <div className='mb-4'>
                  <span className='text-4xl font-bold'>€15</span>
                  <span className='text-muted-foreground'>/month</span>
                </div>
                <p className='text-sm text-muted-foreground'>
                  For freelancers and solo professionals
                </p>
              </div>

              <ul className='mb-8 flex-1 space-y-3'>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>
                    <strong>Unlimited</strong> change orders
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>AI-powered request analysis</span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>
                    <strong>No watermarks</strong> on PDFs
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>
                    <strong>Automatic email</strong> to customers
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>
                    <strong>Custom branding</strong> (logo, colors)
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>
                    <strong>Custom templates</strong>
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>Priority support</span>
                </li>
              </ul>

              <Button asChild size='lg' className='w-full'>
                <Link href='/auth/sign-up'>Start Pro Trial</Link>
              </Button>
            </div>

            {/* Business Plan */}
            <div className='relative flex flex-col rounded-lg border bg-card p-8 opacity-90'>
              <div className='absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-muted px-4 py-1 text-sm font-semibold text-muted-foreground border'>
                Coming Soon
              </div>

              <div className='mb-6'>
                <h3 className='mb-2 text-2xl font-bold'>Business</h3>
                <div className='mb-4'>
                  <span className='text-4xl font-bold'>€29</span>
                  <span className='text-muted-foreground'>/month</span>
                </div>
                <p className='text-sm text-muted-foreground'>
                  For agencies and teams
                </p>
              </div>

              <ul className='mb-8 flex-1 space-y-3'>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-primary' />
                  <span className='text-sm'>
                    <strong>Everything in Pro</strong>
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-muted-foreground' />
                  <span className='text-sm text-muted-foreground'>
                    <strong>Team collaboration</strong>
                    <span className='ml-2 rounded bg-muted px-2 py-0.5 text-xs'>
                      Soon
                    </span>
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-muted-foreground' />
                  <span className='text-sm text-muted-foreground'>
                    <strong>Approval workflow</strong>
                    <span className='ml-2 rounded bg-muted px-2 py-0.5 text-xs'>
                      Soon
                    </span>
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-muted-foreground' />
                  <span className='text-sm text-muted-foreground'>
                    <strong>eSign integration</strong>
                    <span className='ml-2 rounded bg-muted px-2 py-0.5 text-xs'>
                      Soon
                    </span>
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-muted-foreground' />
                  <span className='text-sm text-muted-foreground'>
                    <strong>Stripe integration</strong>
                    <span className='ml-2 rounded bg-muted px-2 py-0.5 text-xs'>
                      Soon
                    </span>
                  </span>
                </li>
                <li className='flex items-start gap-3'>
                  <Check className='h-5 w-5 shrink-0 text-muted-foreground' />
                  <span className='text-sm text-muted-foreground'>
                    <strong>Advanced analytics</strong>
                    <span className='ml-2 rounded bg-muted px-2 py-0.5 text-xs'>
                      Soon
                    </span>
                  </span>
                </li>
              </ul>

              <Button
                asChild
                variant='outline'
                size='lg'
                className='w-full bg-transparent'
                disabled
              >
                <Link href='/auth/sign-up'>Notify Me</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className='border-t px-6 py-8 text-center text-sm text-muted-foreground'>
        <p>&copy; 2025 ScopeSafe. All rights reserved.</p>
      </footer>
    </div>
  );
}
