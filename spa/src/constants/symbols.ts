import { ComputedRef, InjectionKey } from "vue";

export const SearchSymbol = Symbol() as InjectionKey<ComputedRef<string>>;
