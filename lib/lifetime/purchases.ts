import {
  LIFETIME_TIER_LIMITS,
  type LifetimeTier,
} from '../lifetime';

export type LifetimeTierKey = Exclude<LifetimeTier, 'closed'>;
export const LIFETIME_TIER_SEQUENCE: LifetimeTierKey[] = [
  'early',
  'mid',
  'final',
];

export type LifetimePurchaseStatus =
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'expired'
  | 'refunded';

export type LifetimePurchaseRow = {
  id: string;
  user_id: string | null;
  email?: string | null;
  tier: LifetimeTierKey | null;
  status: LifetimePurchaseStatus;
  reserved_expires_at: string | null;
  created_at: string | null;
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
};

export type LifetimeTierLimitRow = {
  tier: LifetimeTierKey | null;
  max_slots: number | null;
};

export type LifetimePurchaseWithTier = LifetimePurchaseRow & {
  tier: LifetimeTierKey;
};

export type LifetimeAvailability = {
  tierLimits: Record<LifetimeTierKey, number>;
  effectiveMaxSlots: number;
  reservedSlots: number;
  availableSlots: number;
  totalActive: number;
  totalPaid: number;
  tier: LifetimeTier;
  activeTier: LifetimeTierKey | null;
  remainingInTier: number;
  claimedPercentage: number;
};

export type UserLifetimeStatus =
  | {
      tier: LifetimeTierKey;
      status: 'paid';
      reservationExpiresAt: null;
      purchase: LifetimePurchaseWithTier;
    }
  | {
      tier: LifetimeTierKey;
      status: 'pending';
      reservationExpiresAt: string | null;
      purchase: LifetimePurchaseWithTier;
    }
  | {
      tier: null;
      status: null;
      reservationExpiresAt: null;
      purchase: null;
    };

export type LifetimeAnalysisResult = {
  availability: LifetimeAvailability;
  activePurchases: LifetimePurchaseWithTier[];
  paidPurchases: LifetimePurchaseWithTier[];
};

export function isLifetimeTierKey(value: unknown): value is LifetimeTierKey {
  return (
    typeof value === 'string' &&
    (value === 'early' || value === 'mid' || value === 'final')
  );
}

export function resolveTierLimits(
  rows: LifetimeTierLimitRow[] | null | undefined
): Record<LifetimeTierKey, number> {
  const limits: Record<LifetimeTierKey, number> = {
    early: LIFETIME_TIER_LIMITS.early,
    mid: LIFETIME_TIER_LIMITS.mid,
    final: LIFETIME_TIER_LIMITS.final,
  };

  if (!rows) {
    return limits;
  }

  for (const row of rows) {
    if (
      row &&
      isLifetimeTierKey(row.tier) &&
      typeof row.max_slots === 'number' &&
      row.max_slots >= 0
    ) {
      limits[row.tier] = row.max_slots;
    }
  }

  return limits;
}

export function determineTierFromCount(
  count: number,
  limits: Record<LifetimeTierKey, number>
): LifetimeTier {
  if (count >= limits.final) return 'closed';
  if (count >= limits.mid) return 'final';
  if (count >= limits.early) return 'mid';
  return 'early';
}

export function remainingSlotsForTier(
  count: number,
  tier: LifetimeTier,
  limits: Record<LifetimeTierKey, number>
): number {
  if (tier === 'closed') return 0;
  const limit = limits[tier];
  return Math.max(limit - count, 0);
}

export function isPendingPurchaseActive(
  purchase: LifetimePurchaseRow,
  nowMs: number
): purchase is LifetimePurchaseWithTier {
  if (!isLifetimeTierKey(purchase.tier)) {
    return false;
  }

  if (purchase.status !== 'pending') {
    return false;
  }

  if (!purchase.reserved_expires_at) {
    return true;
  }

  const expiresAt = Date.parse(purchase.reserved_expires_at);
  if (Number.isNaN(expiresAt)) {
    return true;
  }

  return expiresAt > nowMs;
}

export function toActivePurchase(
  purchase: LifetimePurchaseRow,
  nowMs: number
): LifetimePurchaseWithTier | null {
  if (purchase.status === 'paid' && isLifetimeTierKey(purchase.tier)) {
    return { ...purchase, tier: purchase.tier };
  }

  if (isPendingPurchaseActive(purchase, nowMs)) {
    return { ...purchase, tier: purchase.tier! };
  }

  return null;
}

export function analyzeLifetimePurchases(
  purchaseRows: LifetimePurchaseRow[] | null | undefined,
  tierLimitRows: LifetimeTierLimitRow[] | null | undefined,
  nowMs: number = Date.now()
): LifetimeAnalysisResult {
  const tierLimits = resolveTierLimits(tierLimitRows);

  const purchases = Array.isArray(purchaseRows) ? purchaseRows : [];
  const activePurchases: LifetimePurchaseWithTier[] = [];
  const paidPurchases: LifetimePurchaseWithTier[] = [];

  for (const purchase of purchases) {
    if (!purchase) continue;
    if (!isLifetimeTierKey(purchase.tier)) continue;

    if (purchase.status === 'paid') {
      const normalized: LifetimePurchaseWithTier = {
        ...purchase,
        tier: purchase.tier,
      };
      paidPurchases.push(normalized);
      activePurchases.push(normalized);
      continue;
    }

    const active = toActivePurchase(purchase, nowMs);
    if (active) {
      activePurchases.push(active);
    }
  }

  const totalActive = activePurchases.length;
  const totalPaid = paidPurchases.length;
  const tier = determineTierFromCount(totalActive, tierLimits);
  const activeTier = tier === 'closed' ? null : tier;
  const effectiveMaxSlots = Math.max(
    tierLimits.early,
    tierLimits.mid,
    tierLimits.final
  );
  const reservedSlots = Math.min(totalActive, effectiveMaxSlots);
  const availableSlots = Math.max(effectiveMaxSlots - totalActive, 0);
  const remainingInTier = remainingSlotsForTier(totalActive, tier, tierLimits);
  const claimedPercentage =
    effectiveMaxSlots > 0
      ? Math.min(100, Math.round((totalActive / effectiveMaxSlots) * 100))
      : 0;

  return {
    availability: {
      tierLimits,
      effectiveMaxSlots,
      reservedSlots,
      availableSlots,
      totalActive,
      totalPaid,
      tier,
      activeTier,
      remainingInTier,
      claimedPercentage,
    },
    activePurchases,
    paidPurchases,
  };
}

export function resolveUserLifetimeStatus(
  activePurchases: LifetimePurchaseWithTier[],
  userId: string | null | undefined,
  nowMs: number = Date.now()
): UserLifetimeStatus {
  if (!userId) {
    return {
      tier: null,
      status: null,
      reservationExpiresAt: null,
      purchase: null,
    };
  }

  const userPurchases = activePurchases
    .filter((purchase) => purchase.user_id === userId)
    .sort((a, b) => {
      const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
      const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
      return bCreated - aCreated;
    });

  const paidPurchase = userPurchases.find(
    (purchase) => purchase.status === 'paid'
  );

  if (paidPurchase) {
    return {
      tier: paidPurchase.tier,
      status: 'paid',
      reservationExpiresAt: null,
      purchase: paidPurchase,
    };
  }

  const pendingPurchase = userPurchases.find((purchase) => {
    if (purchase.status !== 'pending') return false;
    if (!purchase.reserved_expires_at) return true;
    const expiresAt = Date.parse(purchase.reserved_expires_at);
    if (Number.isNaN(expiresAt)) return true;
    return expiresAt > nowMs;
  });

  if (pendingPurchase) {
    return {
      tier: pendingPurchase.tier,
      status: 'pending',
      reservationExpiresAt: pendingPurchase.reserved_expires_at ?? null,
      purchase: pendingPurchase,
    };
  }

  return {
    tier: null,
    status: null,
    reservationExpiresAt: null,
    purchase: null,
  };
}
