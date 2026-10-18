const HOPS_PATTERN = /^\d+$/;

/**
 * Decides the Express `trust proxy` setting. A valid TRUST_PROXY_HOPS (a
 * non-negative integer; 0 = do not trust) wins. Unset, empty or invalid keeps
 * the old default: trust one hop for an HTTPS frontend, otherwise leave unset.
 */
export function resolveTrustProxy(hops: string | undefined, frontendUrl: string): number | undefined {
  const trimmed = (hops ?? '').trim();
  if (HOPS_PATTERN.test(trimmed)) {
    const value = Number(trimmed);
    if (Number.isSafeInteger(value)) {
      return value;
    }
  }
  return frontendUrl.startsWith('https://') ? 1 : undefined;
}
