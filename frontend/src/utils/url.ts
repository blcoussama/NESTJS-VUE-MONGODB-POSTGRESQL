/**
 * Returns the URL only if it is an absolute http(s) URL, otherwise null.
 * Prevents `javascript:` / `data:` URLs coming from user-provided profile fields
 * (website, LinkedIn…) from ending up in an `href` or `src`.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/** Adds `https://` when the user typed a bare domain (e.g. "alten.ma"). */
export function withProtocol(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '' || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/**
 * Only same-app paths are accepted as post-login redirects (no open redirect):
 * must start with a single "/" and must not be protocol-relative ("//evil.com") or "/\\".
 */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}

/** Opens a (presigned) URL in a new tab without giving it access to `window.opener`. */
export function openInNewTab(url: string): void {
  const safe = safeHttpUrl(url)
  if (!safe) return
  const link = document.createElement('a')
  link.href = safe
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
