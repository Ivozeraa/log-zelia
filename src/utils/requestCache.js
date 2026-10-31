// Cache em memória por usuário/escola, com deduplicação de requisições concorrentes.
// Nunca persistimos respostas potencialmente privadas no localStorage.
const entries = new Map();

export function loadCached(key, loader, { ttl = 60_000, force = false } = {}) {
  const existing = entries.get(key);
  if (!force && existing && existing.expiresAt > Date.now()) {
    return existing.promise;
  }

  const promise = Promise.resolve().then(loader);
  entries.set(key, { promise, expiresAt: Date.now() + ttl });
  promise.catch(() => {
    if (entries.get(key)?.promise === promise) entries.delete(key);
  });
  return promise;
}

export function clearCached(prefix = "") {
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
