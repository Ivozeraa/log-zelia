import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

const DEFAULT_CONFIG = {
  nome_aplicacao: "LogView",
};

export function usePlatformConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("logview_config")
      .select("nome_aplicacao")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Erro carregando configuração da plataforma:", error);
      setConfig(DEFAULT_CONFIG);
    } else {
      setConfig({ ...DEFAULT_CONFIG, ...(data || {}) });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { config, loading, refresh: load };
}
