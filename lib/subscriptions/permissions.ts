import type { LifetimeTier } from "../lifetime"
import type { SubscriptionTier } from "./plans"

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set<string>(["active", "trialing", "past_due"])

export interface SubscriptionEntitlements {
  tier: SubscriptionTier
  status: string | null
  maxMonthlyChangeOrders: number | null
  watermarkText: string | null
  canSendEmails: boolean
  hasLifetimeAccess: boolean
}

const MONTHLY_CHANGE_ORDER_LIMITS: Record<SubscriptionTier, number | null> = {
  free: 3,
  pro: null,
  business: null,
}

function isPaidTier(tier: SubscriptionTier) {
  return tier === "pro" || tier === "business"
}

function hasActivePaidStatus(status: string | null | undefined) {
  if (!status) return false
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status)
}

interface EntitlementOptions {
  lifetimeTier?: LifetimeTier | null | undefined
}

export function getSubscriptionEntitlements(
  tier: SubscriptionTier | null | undefined,
  status: string | null | undefined,
  { lifetimeTier }: EntitlementOptions = {}
): SubscriptionEntitlements {
  const normalizedTier: SubscriptionTier = tier && (["free", "pro", "business"] as const).includes(tier as SubscriptionTier)
    ? (tier as SubscriptionTier)
    : "free"
  const normalizedStatus = status ?? null

  const hasLifetimeAccess = Boolean(lifetimeTier && lifetimeTier !== "closed")
  const isPaid = isPaidTier(normalizedTier)
  const hasPaidAccess = isPaid ? hasActivePaidStatus(normalizedStatus) : false

  const entitlementTier: SubscriptionTier =
    hasLifetimeAccess ? "business" : isPaid && !hasPaidAccess ? "free" : normalizedTier

  const maxMonthlyChangeOrders = hasLifetimeAccess ? null : MONTHLY_CHANGE_ORDER_LIMITS[entitlementTier] ?? null

  const watermarkText =
    hasLifetimeAccess ? null : entitlementTier === "free" ? "powered by ScopeSafe" : null

  const canSendEmails = hasLifetimeAccess || (isPaid && hasPaidAccess)

  return {
    tier: normalizedTier,
    status: normalizedStatus,
    maxMonthlyChangeOrders,
    watermarkText,
    canSendEmails,
    hasLifetimeAccess,
  }
}

export function isChangeOrderLimitReached(
  usageCount: number | null | undefined,
  entitlements: SubscriptionEntitlements | null | undefined
) {
  if (!entitlements) return false
  const { maxMonthlyChangeOrders } = entitlements
  if (maxMonthlyChangeOrders === null || maxMonthlyChangeOrders === undefined) {
    return false
  }
  if (typeof usageCount !== "number") return false
  return usageCount >= maxMonthlyChangeOrders
}
