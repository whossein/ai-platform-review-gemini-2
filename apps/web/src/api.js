/**
 * Typed client for the @ai-review/api server. The Web and Desktop UIs share this
 * module so both speak to the exact same review pipeline. All calls go through
 * the `/api` prefix, which Vite proxies to the API server in dev (see
 * vite.config.ts) and which a reverse proxy handles in production.
 */
export async function requestEstimate(diff, env) {
  const res = await fetch("/api/estimate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ diff, ...(env ? { env } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `estimate failed (${res.status})`);
  }
  return await res.json();
}
export async function requestReview(
  diff,
  threshold,
  env,
  selectedSpecialists,
  signal,
) {
  const reqInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      diff,
      ...(threshold !== undefined ? { threshold } : {}),
      ...(env ? { env } : {}),
      ...(selectedSpecialists ? { selectedSpecialists } : {}),
    }),
  };
  if (signal) {
    reqInit.signal = signal;
  }
  const res = await fetch("/api/review", reqInit);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `review failed (${res.status})`);
  }
  return await res.json();
}
export async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    return res.ok;
  } catch {
    return false;
  }
}
export async function requestPublish(diff, issues, env) {
  const res = await fetch("/api/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ diff, issues, ...(env ? { env } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `publish failed (${res.status})`);
  }
  return await res.json();
}
export async function requestApplyLocal(localPath, issues) {
  const res = await fetch("/api/apply-local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ localPath, issues }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `apply failed (${res.status})`);
  }
  return await res.json();
}
export async function requestTestProvider(config) {
  const res = await fetch("/api/test-provider", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  const data = await res
    .json()
    .catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  return data;
}
