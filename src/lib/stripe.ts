import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_during_build';

export const stripe = new Stripe(secretKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
});
