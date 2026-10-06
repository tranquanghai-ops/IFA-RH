export const ALLOWED_DOMAINS = ["tdtu.edu.vn"];
export const NOMINATED_OWNER_EMAIL = "tranquanghai@tdtu.edu.vn";

/**
 * Check if an email is an allowed TDTU domain
 */
export function isAllowedTDTUEmail(email: string): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ALLOWED_DOMAINS.some((domain) => normalized.endsWith(`@${domain}`));
}

/**
 * Normalize email string
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
