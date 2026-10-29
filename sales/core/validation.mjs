export const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
export const text = (value, label, max = 300, required = true) => {
  const result = typeof value === "string" ? value.trim() : "";
  if ((required && !result) || result.length > max) fail(`Check ${label}.`);
  return result;
};
export function money(value, label = "amount") {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value)))
    fail(`Enter a valid ${label} (up to two decimal places).`);
  const [whole, fraction = ""] = String(value).split("."),
    n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n > 1e12) fail(`${label} is too large.`);
  return n;
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
