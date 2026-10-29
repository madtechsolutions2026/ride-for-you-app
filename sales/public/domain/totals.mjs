import { STATES, stateTaxLabel, roundDivide } from "./tax-metadata.mjs";
function amount(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw Error("Amounts must be non-negative integer paise.");
  return value;
}
export function productTotals(
  input,
  discount,
  priceMode,
  sellerState,
  placeOfSupply,
) {
  if (!input.length || !["inclusive", "exclusive"].includes(priceMode))
    throw Error(
      "Select whether prices include GST or GST is added separately.",
    );
  if (!STATES[sellerState] || !STATES[placeOfSupply])
    throw Error("Choose the seller state and place of supply.");
  const subtotal = input.reduce((sum, line) => sum + amount(line.salePrice), 0);
  amount(discount);
  if (!subtotal || discount >= subtotal)
    throw Error("Discount must be less than the quoted subtotal.");
  const allocations = input.map((line, index) => {
    const product = BigInt(discount) * BigInt(line.salePrice);
    return {
      index,
      discount: Number(product / BigInt(subtotal)),
      remainder: product % BigInt(subtotal),
    };
  });
  let remaining =
    discount - allocations.reduce((sum, row) => sum + row.discount, 0);
  const ranked = [...allocations].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (let i = 0; i < remaining; i++) ranked[i].discount++;
  const intraState = sellerState === placeOfSupply;
  const lines = input.map((line, index) => {
    if (!/^\d{4}(?:\d{2}){0,2}$/.test(line.hsn || ""))
      throw Error("Enter the product HSN (4, 6 or 8 digits).");
    const rate = line.gstRate;
    if (!Number.isInteger(rate) || rate < 0 || rate > 4000)
      throw Error("Enter a GST rate from 0 to 40%, with up to two decimals.");
    const lineDiscount = allocations[index].discount,
      net = line.salePrice - lineDiscount;
    const taxable =
      priceMode === "inclusive"
        ? roundDivide(BigInt(net) * 10000n, 10000 + rate)
        : net;
    const cgst = intraState
      ? roundDivide(BigInt(taxable) * BigInt(rate), 20000)
      : 0;
    const sgst = cgst;
    const igst = intraState
      ? 0
      : roundDivide(BigInt(taxable) * BigInt(rate), 10000);
    const tax = cgst + sgst + igst;
    const roundOff = priceMode === "inclusive" ? net - taxable - tax : 0;
    return {
      ...line,
      hsn: line.hsn,
      quantity: 1,
      unit: "NOS",
      discount: lineDiscount,
      taxable,
      cgst,
      sgst,
      igst,
      tax,
      roundOff,
      total: taxable + tax + roundOff,
      gstRate: rate,
    };
  });
  const sum = (field) => lines.reduce((n, line) => n + line[field], 0);
  return {
    lines,
    subtotal,
    discount,
    priceMode,
    placeOfSupply,
    intraState,
    stateTaxLabel: stateTaxLabel(sellerState),
    taxable: sum("taxable"),
    cgst: sum("cgst"),
    sgst: sum("sgst"),
    igst: sum("igst"),
    tax: sum("tax"),
    roundOff: sum("roundOff"),
    total: sum("total"),
    taxRate: input.every((l) => l.gstRate === input[0].gstRate)
      ? input[0].gstRate
      : null,
  };
}
export function taxRows(data) {
  const rate = data.taxRate == null ? null : data.taxRate / 100;
  return data.intraState
    ? [
        [
          `CGST${rate == null ? " (mixed rates)" : ` (${rate / 2}%)`}`,
          data.cgst,
        ],
        [
          `${data.stateTaxLabel}${rate == null ? " (mixed rates)" : ` (${rate / 2}%)`}`,
          data.sgst,
        ],
      ]
    : [[`IGST${rate == null ? " (mixed rates)" : ` (${rate}%)`}`, data.igst]];
}
