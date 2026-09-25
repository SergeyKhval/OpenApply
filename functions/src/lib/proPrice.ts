/**
 * Read from the environment at runtime rather than declared with
 * defineString: a declared param missing from the deploy dotenv file fails a
 * non-interactive `firebase deploy`, default or not. Unset means Pro isn't
 * on sale yet.
 */
export const proPriceId = () => process.env.STRIPE_PRO_PRICE_ID || "";

export const isProOnSale = () => proPriceId() !== "";
