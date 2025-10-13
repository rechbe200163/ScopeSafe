'use client'

import { useEffect, useMemo, useState } from 'react'

import type { SubscriptionTier } from '@/lib/subscriptions/plans'
import {
  getSubscriptionEntitlements,
  type SubscriptionEntitlements,
} from '@/lib/subscriptions/permissions'
import { createClient } from '@/lib/supabase/client'

interface UseSubscriptionEntitlementsOptions {
  includeMonthlyChangeOrderCount?: boolean
}

interface UseSubscriptionEntitlementsResult {
  entitlements: SubscriptionEntitlements | null
  subscriptionTier: SubscriptionTier
  subscriptionStatus: string | null
  monthlyChangeOrderCount: number | null
  isLoading: boolean
  error: string | null
}

export function useSubscriptionEntitlements(
  options: UseSubscriptionEntitlementsOptions = {}
): UseSubscriptionEntitlementsResult {
  const { includeMonthlyChangeOrderCount = false } = options

  const [entitlements, setEntitlements] =
    useState<SubscriptionEntitlements | null>(null)
  const [subscriptionTier, setSubscriptionTier] =
    useState<SubscriptionTier>('free')
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(
    null
  )
  const [monthlyChangeOrderCount, setMonthlyChangeOrderCount] = useState<
    number | null
  >(includeMonthlyChangeOrderCount ? 0 : null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError

        if (!user) {
          if (!isMounted) return
          const fallback = getSubscriptionEntitlements('free', null)
          setEntitlements(fallback)
          setSubscriptionTier('free')
          setSubscriptionStatus(null)
          if (includeMonthlyChangeOrderCount) {
            setMonthlyChangeOrderCount(0)
          }
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('subscription_tier, subscription_status')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError

        const tier = (profile?.subscription_tier as SubscriptionTier) ?? 'free'
        const status = (profile?.subscription_status as string | null) ?? null
        const computedEntitlements = getSubscriptionEntitlements(tier, status)

        if (!isMounted) return
        setSubscriptionTier(tier)
        setSubscriptionStatus(status)
        setEntitlements(computedEntitlements)

        if (
          includeMonthlyChangeOrderCount &&
          computedEntitlements.maxMonthlyChangeOrders !== null
        ) {
          const now = new Date()
          const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

          const { count, error: countError } = await supabase
            .from('change_orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', startOfMonth.toISOString())

          if (countError) throw countError

          if (isMounted) {
            setMonthlyChangeOrderCount(typeof count === 'number' ? count : 0)
          }
        } else if (includeMonthlyChangeOrderCount && isMounted) {
          setMonthlyChangeOrderCount(null)
        }
      } catch (err) {
        console.error('Failed to load subscription entitlements:', err)
        if (!isMounted) return
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load subscription details'
        )
        setEntitlements((previous) =>
          previous ?? getSubscriptionEntitlements('free', null)
        )
        if (includeMonthlyChangeOrderCount) {
          setMonthlyChangeOrderCount(0)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [includeMonthlyChangeOrderCount, supabase])

  return {
    entitlements,
    subscriptionTier,
    subscriptionStatus,
    monthlyChangeOrderCount,
    isLoading,
    error,
  }
}
