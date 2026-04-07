import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_during_build';

export const stripe = new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia',
    typescript: true,
});
