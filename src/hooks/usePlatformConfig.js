import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabase";
import { loadCached } from "../utils/requestCache";

const DEFAULT_CONFIG = {
  nome_aplicacao: "LogView",
  cor_primaria: "#4CA65A",
  cor_secundaria: "#F2762E",
};

export function usePlatformConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const active = useRef(true);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const data = await loadCached("platform-config", async () => {
        const result = await supabase.from("logview_config")
          .select("nome_aplicacao, cor_primaria, cor_secundaria")
          .eq("id", 1).maybeSingle();
        if (result.error) throw result.error;
        return result.data;
      }, { ttl: 60_000, force });
      if (active.current) setConfig({ ...DEFAULT_CONFIG, ...(data || {}) });
    } catch (error) {
      console.error("Erro carregando configuração da plataforma:", error);
      if (active.current) setConfig(DEFAULT_CONFIG);
    } finally {
      if (active.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    void load();
    return () => { active.current = false; };
  }, [load]);

  return { config, loading, refresh: () => load(true) };
}
