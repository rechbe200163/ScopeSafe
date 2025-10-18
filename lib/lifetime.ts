export type LifetimeTier = 'early' | 'mid' | 'final' | 'closed';

export const MAX_LIFETIME_SLOTS = 150;

export const LIFETIME_TIER_LIMITS: Record<
  Exclude<LifetimeTier, 'closed'>,
  number
> = {
  early: 50,
  mid: 125,
  final: 150,
};

export const LIFETIME_TIER_PRICING: Record<
  Exclude<LifetimeTier, 'closed'>,
  number
> = {
  early: 100,
  mid: 149,
  final: 200,
};

export function determineLifetimeTier(count: number): LifetimeTier {
  if (count >= MAX_LIFETIME_SLOTS) return 'closed';
  if (count >= LIFETIME_TIER_LIMITS.final) return 'final';
  if (count >= LIFETIME_TIER_LIMITS.mid) return 'mid';
  return 'early';
}

export function remainingSlotsForTier(
  count: number,
  tier: LifetimeTier,
): number {
  if (tier === 'closed') return 0;
  const limit = LIFETIME_TIER_LIMITS[tier];
  return Math.max(limit - count, 0);
}

export function getLifetimeStripeProductId(
  tier: Exclude<LifetimeTier, 'closed'>,
): string | null {
  switch (tier) {
    case 'early':
      return process.env.STRIPE_PRODUCT_ID_EARLY_SUPPORTER_LIFETIME ?? null;
    case 'mid':
      return process.env.STRIPE_PRODUCT_ID_EARLY_BIRD_LIFETIME ?? null;
    case 'final':
      return process.env.STRIPE_PRODUCT_ID_FINAL_WAVE_LIFETIME ?? null;
    default:
      return null;
  }
}
