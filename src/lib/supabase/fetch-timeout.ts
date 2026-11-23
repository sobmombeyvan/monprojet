/**
 * fetch with a time limit for every server-side Supabase call.
 * Without it, a request stuck on a bad network never ends: the page never finishes
 * rendering and the admin sees nothing happen after clicking. With it, the call fails
 * after SUPABASE_TIMEOUT_MS and the normal error handling takes over.
 */
const SUPABASE_TIMEOUT_MS = 20_000;

export const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(SUPABASE_TIMEOUT_MS);
  // AbortSignal.any may be missing in some runtimes (e.g. Edge middleware): keep the caller's signal then
  const signal = !init?.signal ? timeout : typeof AbortSignal.any === "function" ? AbortSignal.any([init.signal, timeout]) : init.signal;
  return fetch(input, { ...init, signal });
};
