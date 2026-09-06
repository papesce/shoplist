import type { Entry, Summary } from "../types";

export function calcSummary(list: Entry[]): Summary {
  const withQuantity = list.filter((e) => /^[\d.,/]/.test(e.original)).length;
  return {
    total: list.length,
    withQuantity,
    textOnly: list.length - withQuantity,
  };
}
