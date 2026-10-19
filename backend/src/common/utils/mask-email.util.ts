/**
 * Masks an email address for logs: "oussama@example.com" → "o***@example.com".
 * Logs must not become a directory of user email addresses.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}
