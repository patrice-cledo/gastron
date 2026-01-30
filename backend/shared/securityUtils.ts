/**
 * Security utilities for recipe import
 * Prevents SSRF attacks and abuse
 */

/**
 * Check if URL is safe to fetch (SSRF protection)
 */
export function isUrlSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);

    // Must be HTTP or HTTPS
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Only HTTP and HTTPS URLs are allowed' };
    }

    // Block localhost and private IP ranges
    const hostname = parsed.hostname.toLowerCase();
    
    // Localhost variants
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname === '::1' ||
        hostname.startsWith('localhost.')) {
      return { safe: false, reason: 'Localhost URLs are not allowed' };
    }

    // Private IP ranges (RFC 1918)
    const privateIpPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local
      /^fc00:/, // IPv6 private
      /^fe80:/, // IPv6 link-local
    ];

    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: 'Private IP ranges are not allowed' };
      }
    }

    // Note: file://, chrome://, about: are already blocked by the http/https check above
    // This check is redundant but kept for clarity

    return { safe: true };
  } catch (error) {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

/**
 * Check if domain is in allowlist (optional)
 */
export function isDomainAllowed(hostname: string, allowlist?: string[]): boolean {
  if (!allowlist || allowlist.length === 0) {
    return true; // No allowlist = all domains allowed
  }

  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  return allowlist.some(domain => {
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
    return normalized === normalizedDomain || normalized.endsWith('.' + normalizedDomain);
  });
}

/**
 * Check if domain is in denylist
 */
export function isDomainBlocked(hostname: string, denylist?: string[]): boolean {
  if (!denylist || denylist.length === 0) {
    return false; // No denylist = no domains blocked
  }

  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  return denylist.some(domain => {
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
    return normalized === normalizedDomain || normalized.endsWith('.' + normalizedDomain);
  });
}

/**
 * Validate URL for import
 */
export function validateImportUrl(
  url: string,
  options?: {
    allowlist?: string[];
    denylist?: string[];
  }
): { valid: boolean; reason?: string } {
  // Check URL safety (SSRF protection)
  const safetyCheck = isUrlSafe(url);
  if (!safetyCheck.safe) {
    return { valid: false, reason: safetyCheck.reason };
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Check denylist
    if (isDomainBlocked(hostname, options?.denylist)) {
      return { valid: false, reason: 'Domain is blocked' };
    }

    // Check allowlist (if provided)
    if (options?.allowlist && !isDomainAllowed(hostname, options.allowlist)) {
      return { valid: false, reason: 'Domain not in allowlist' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: 'Invalid URL format' };
  }
}
