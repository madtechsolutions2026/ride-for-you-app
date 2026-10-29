import { productTotals } from "./domain/totals.mjs";
import { EV_HSN, DEFAULT_HSN, EV_GST_BPS } from "./domain/tax-metadata.mjs";
export * from "./domain/tax-metadata.mjs";
export function gstTotals(
  input,
  discount,
  priceMode,
  sellerState,
  placeOfSupply,
) {
  for (const line of input)
    if (!EV_HSN[line.hsn || DEFAULT_HSN])
      throw Error("Choose a valid complete electric two-wheeler HSN.");
  return productTotals(
    input.map((line) => ({
      ...line,
      hsn: line.hsn || DEFAULT_HSN,
      gstRate: EV_GST_BPS,
    })),
    discount,
    priceMode,
    sellerState,
    placeOfSupply,
  );
}
