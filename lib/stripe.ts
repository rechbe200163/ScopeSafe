import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn(
    'Stripe secret key is not configured. Subscription APIs will fail.'
  );
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-09-30.clover',
    })
  : null;

export async function getActivePriceIdForProduct(productId: string) {
  if (!stripe) return null;

  try {
    const product = await stripe.products.retrieve(productId, {
      expand: ['default_price'],
    });

    const defaultPrice = product.default_price;

    if (typeof defaultPrice === 'string') {
      return defaultPrice;
    }

    if (
      defaultPrice &&
      typeof defaultPrice === 'object' &&
      'id' in defaultPrice &&
      typeof defaultPrice.id === 'string'
    ) {
      return defaultPrice.id;
    }
  } catch (error) {
    console.error('Stripe product lookup failed:', error);
  }

  try {
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1,
    });

    return prices.data[0]?.id ?? null;
  } catch (error) {
    console.error('Stripe price lookup failed:', error);
    return null;
  }
}
