import type { SubscriptionTier } from "./plans"

export function getStripeProductId(tier: SubscriptionTier) {
  switch (tier) {
    case "pro":
      return process.env.STRIPE_PRODUCT_ID_PRO || null
    case "business":
      return process.env.STRIPE_PRODUCT_ID_BUSINESS || null
    default:
      return null
  }
}

export function getSuccessUrl() {
  return (
    process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings?checkout=success`
  )
}

export function getCancelUrl() {
  return (
    process.env.STRIPE_CHECKOUT_CANCEL_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings?checkout=cancelled`
  )
}

export function getPortalReturnUrl() {
  return (
    process.env.STRIPE_PORTAL_RETURN_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings`
  )
}

export function resolveTierFromProductId(productId: string | null | undefined): SubscriptionTier | null {
  if (!productId) return null
  if (productId === process.env.STRIPE_PRODUCT_ID_PRO) return "pro"
  if (productId === process.env.STRIPE_PRODUCT_ID_BUSINESS) return "business"
  return null
}
