export type SubscriptionTier = "free" | "pro" | "business"

export interface SubscriptionPlan {
  id: SubscriptionTier
  name: string
  priceLabel: string
  price: number
  interval: string
  description: string
  badge?: string
  stripePriceKey?: string
  features: Array<{
    label: string
    included: boolean
    soon?: boolean
  }>
}

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "€0",
    price: 0,
    interval: "month",
    description: "Perfect for trying out ScopeSafe",
    features: [
      { label: "3 change orders per month", included: true },
      { label: "AI-powered analysis", included: true },
      { label: "PDF generation", included: true },
      { label: "Watermark-free PDFs", included: false },
      { label: "Automatically email customers", included: false },
      { label: "Custom branding", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "€15",
    price: 15,
    interval: "month",
    description: "For freelancers and solo professionals",
    badge: "Most Popular",
    features: [
      { label: "Unlimited change orders", included: true },
      { label: "AI-powered analysis", included: true },
      { label: "PDF generation without watermarks", included: true },
      { label: "Automatically email customers", included: true },
      { label: "Custom branding", included: true },
      { label: "Custom templates", included: true },
    ],
  },
  {
    id: "business",
    name: "Business",
    priceLabel: "€29",
    price: 29,
    interval: "month",
    description: "For agencies and teams",
    features: [
      { label: "Everything in Pro", included: true },
      { label: "Team collaboration", included: true },
      { label: "Approval workflow", included: true },
      { label: "eSign integration", included: false, soon: true },
      { label: "Stripe integration", included: false, soon: true },
    ],
  },
]

export function getPlanById(tier: SubscriptionTier) {
  return subscriptionPlans.find((plan) => plan.id === tier)
}

