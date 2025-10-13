'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import type { SubscriptionTier } from '@/lib/subscriptions/plans';

interface DashboardNavProps {
  userName?: string;
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
}

const activeStatuses = new Set(['active', 'trialing', 'past_due']);
const validTiers: SubscriptionTier[] = ['free', 'pro', 'business'];

function formatStatusLabel(status?: string | null) {
  if (!status) return '';
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function DashboardNav({
  userName,
  subscriptionTier = 'free',
  subscriptionStatus,
}: DashboardNavProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const normalizedTier = useMemo<SubscriptionTier>(() => {
    if (validTiers.includes(subscriptionTier as SubscriptionTier)) {
      return subscriptionTier as SubscriptionTier;
    }
    return 'free';
  }, [subscriptionTier]);
  const nextPlan = useMemo(() => {
    if (normalizedTier === 'free') return 'pro' as const;
    if (normalizedTier === 'pro') return 'business' as const;
    return null;
  }, [normalizedTier]);

  const isActive = subscriptionStatus
    ? activeStatuses.has(subscriptionStatus)
    : normalizedTier === 'free';
  const planLabel = useMemo(() => {
    const planBase =
      normalizedTier === 'business'
        ? 'Business'
        : normalizedTier === 'pro'
        ? 'Pro'
        : 'Free';
    if (normalizedTier === 'free') return planBase;
    if (!isActive && subscriptionStatus) {
      return `${planBase} - ${formatStatusLabel(subscriptionStatus)}`;
    }
    return planBase;
  }, [normalizedTier, isActive, subscriptionStatus]);

  return (
    <nav className='flex h-16 items-center justify-between border-b bg-card px-6'>
      <div className='flex items-center gap-8'>
        <Link href='/dashboard' className='text-xl font-bold'>
          ScopeSafe
        </Link>
        <div className='flex items-center gap-1'>
          <Button variant='ghost' size='sm' asChild>
            <Link href='/dashboard'>
              <LayoutDashboard className='mr-2 h-4 w-4' />
              Dashboard
            </Link>
          </Button>
          <Button variant='ghost' size='sm' asChild>
            <Link href='/dashboard/projects'>
              <FolderOpen className='mr-2 h-4 w-4' />
              Projects
            </Link>
          </Button>
          <Button variant='ghost' size='sm' asChild>
            <Link href='/dashboard/history'>
              <FileText className='mr-2 h-4 w-4' />
              History
            </Link>
          </Button>
        </div>
      </div>
      <div className='flex items-center gap-4'>
        {userName && (
          <div className='flex items-center gap-2'>
            <Badge variant='secondary' className='text-xs font-semibold'>
              {planLabel}
            </Badge>
            <span className='text-sm text-muted-foreground'>
              Welcome, {userName}
            </span>
          </div>
        )}
        <Button variant='ghost' size='sm' asChild>
          <Link href='/dashboard/settings'>
            <Settings className='mr-2 h-4 w-4' />
            Settings
          </Link>
        </Button>
        <Button variant='ghost' size='sm' onClick={handleSignOut}>
          <LogOut className='mr-2 h-4 w-4' />
          Sign Out
        </Button>
      </div>
    </nav>
  );
}
