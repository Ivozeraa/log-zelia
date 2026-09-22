import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const globalKey = "__supabase_singleton__";
const performanceDebugKey = "logview:performance-debug";

const isPerformanceDebugEnabled = () => {
  try {
    return import.meta.env.DEV || window.localStorage.getItem(performanceDebugKey) === "1";
  } catch {
    return Boolean(import.meta.env.DEV);
  }
};

const timedFetch = async (input, init) => {
  const started = performance.now();

  try {
    const response = await fetch(input, init);
    if (isPerformanceDebugEnabled()) {
      const url = typeof input === "string" ? input : input?.url || "";
      const path = (() => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      })();
      const elapsed = Math.round(performance.now() - started);
      console.info("[LogView] [HTTP]", {
        method: init?.method || "GET",
        path,
        status: response.status,
        elapsedMs: elapsed,
      });
    }
    return response;
  } catch (error) {
    if (isPerformanceDebugEnabled()) {
      const url = typeof input === "string" ? input : input?.url || "";
      const elapsed = Math.round(performance.now() - started);
      console.error("[LogView] [HTTP] falhou", { url, elapsedMs: elapsed, error });
    }
    throw error;
  }
};

if (!window[globalKey]) {
  window[globalKey] = createClient(supabaseUrl, supabaseKey, {
    auth: {
      // Mantém a sessão entre acessos ao navegador sem armazenar a senha.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      // Instrumentação temporária: permite separar latência HTTP da execução do Postgres.
      fetch: timedFetch,
    },
  });
}

export const supabase = window[globalKey];
