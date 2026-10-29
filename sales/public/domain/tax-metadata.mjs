// Shared, integer-paise calculations for complete electric two-wheelers only.
export const EV_GST_BPS = 500;
export const DEFAULT_HSN = "871160";
export const EV_HSN = {
  871160: "Electric two-wheeler",
  87116010: "Electric motorcycle",
  87116020: "Electric scooter",
  87116030: "Electric moped",
  87116080: "E-bicycle / pedal-assisted vehicle",
  87116090: "Other electric two-wheeler",
};
export const STATES = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  10: "Bihar",
  11: "Sikkim",
  12: "Arunachal Pradesh",
  13: "Nagaland",
  14: "Manipur",
  15: "Mizoram",
  16: "Tripura",
  17: "Meghalaya",
  18: "Assam",
  19: "West Bengal",
  20: "Jharkhand",
  21: "Odisha",
  22: "Chhattisgarh",
  23: "Madhya Pradesh",
  24: "Gujarat",
  26: "Dadra and Nagar Haveli and Daman and Diu",
  27: "Maharashtra",
  29: "Karnataka",
  30: "Goa",
  31: "Lakshadweep",
  32: "Kerala",
  33: "Tamil Nadu",
  34: "Puducherry",
  35: "Andaman and Nicobar Islands",
  36: "Telangana",
  37: "Andhra Pradesh",
  38: "Ladakh",
  97: "Other Territory",
};
export const stateName = (code) =>
  STATES[code] ? `${STATES[code]} (${code})` : code;
export const stateTaxLabel = (code) =>
  ["04", "26", "31", "35", "38", "97"].includes(code) ? "UTGST" : "SGST";
export function validGstin(value) {
  if (
    !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value) ||
    !STATES[value.slice(0, 2)]
  )
    return false;
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let factor = 2,
    total = 0;
  for (let index = 13; index >= 0; index--) {
    const product = alphabet.indexOf(value[index]) * factor;
    total += Math.floor(product / 36) + (product % 36);
    factor = factor === 2 ? 1 : 2;
  }
  return alphabet[(36 - (total % 36)) % 36] === value[14];
}
export function financialYear(date) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw Error("Choose a valid invoice date.");
  const start =
    Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 4 ? 1 : 0);
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}
export const roundDivide = (numerator, denominator) =>
  Number((BigInt(numerator) + BigInt(denominator) / 2n) / BigInt(denominator));
