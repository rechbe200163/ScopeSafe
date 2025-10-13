import type { SubscriptionTier } from "./plans"

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set<string>(["active", "trialing", "past_due"])

export interface SubscriptionEntitlements {
  tier: SubscriptionTier
  status: string | null
  maxMonthlyChangeOrders: number | null
  watermarkText: string | null
  canSendEmails: boolean
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

export function getSubscriptionEntitlements(
  tier: SubscriptionTier | null | undefined,
  status: string | null | undefined
): SubscriptionEntitlements {
  const normalizedTier: SubscriptionTier = tier && (["free", "pro", "business"] as const).includes(tier as SubscriptionTier)
    ? (tier as SubscriptionTier)
    : "free"
  const normalizedStatus = status ?? null

  const isPaid = isPaidTier(normalizedTier)
  const hasPaidAccess = isPaid ? hasActivePaidStatus(normalizedStatus) : false

  const entitlementTier: SubscriptionTier =
    isPaid && !hasPaidAccess ? "free" : normalizedTier

  const maxMonthlyChangeOrders = MONTHLY_CHANGE_ORDER_LIMITS[entitlementTier] ?? null

  const watermarkText =
    entitlementTier === "free" ? "powered by ScopeSafe" : null

  const canSendEmails = isPaid && hasPaidAccess

  return {
    tier: normalizedTier,
    status: normalizedStatus,
    maxMonthlyChangeOrders,
    watermarkText,
    canSendEmails,
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
