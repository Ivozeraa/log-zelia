const PREFIX = "[LogView]";

export function debugLog(scope, message, details = null) {
  const stamp = new Date().toISOString();
  if (details === null) {
    console.log(`${PREFIX} [${stamp}] [${scope}] ${message}`);
  } else {
    console.log(`${PREFIX} [${stamp}] [${scope}] ${message}`, details);
  }
}

export function debugError(scope, message, error = null) {
  const stamp = new Date().toISOString();
  console.error(`${PREFIX} [${stamp}] [${scope}] ${message}`, error || "");
}

export async function debugQuery(scope, label, promise) {
  const started = performance.now();
  debugLog(scope, `→ ${label}`);
  try {
    const result = await promise;
    const elapsed = Math.round(performance.now() - started);
    if (result?.error) {
      debugError(scope, `← ${label} falhou em ${elapsed}ms`, result.error);
    } else {
      debugLog(scope, `← ${label} concluído em ${elapsed}ms`, {
        rows: Array.isArray(result?.data) ? result.data.length : result?.data ? 1 : 0,
      });
    }
    return result;
  } catch (error) {
    const elapsed = Math.round(performance.now() - started);
    debugError(scope, `← ${label} lançou erro após ${elapsed}ms`, error);
    throw error;
  }
}
