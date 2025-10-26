import fromPairs from "lodash/fromPairs";

type CreditPack = {
  id: string;
  price: number;
  credits: number;
  discount?: number;
};

// these are public ids from Stripe
export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    id: "price_1SJE8pAZ6qTVMaZC4YZ6FC0m",
    price: 2,
    credits: 100,
  },
  {
    id: "price_1SJE8oAZ6qTVMaZCbEkzI5Bb",
    price: 5,
    credits: 300,
    discount: 16,
  },
  {
    id: "price_1SJE95AZ6qTVMaZCg19TqICF",
    price: 12,
    credits: 1000,
    discount: 40,
  },
] as const;

export const CREDIT_PACKS_MAP = fromPairs(
  CREDIT_PACKS.map((pack) => [pack.id, pack.credits]),
);
