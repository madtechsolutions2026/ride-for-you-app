/* The backend answers with { error } on most paths and { message } on a few,
   so reading only one of them silently hides the real reason. Read both. */
export const errMsg = (err: any, fallback: string): string =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  fallback;
