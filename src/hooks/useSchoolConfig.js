import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabase";
import { loadCached } from "../utils/requestCache";
import { useSchool } from "./useSchool";
import { useAuth } from "./useAuth";

const DEFAULT_CONFIG = {
  nome_aplicacao: "LogView",
  logo_url: "",
  cor_primaria: "#16a34a",
  cor_secundaria: "#0f172a",
  versao_id: null,
};

export function useSchoolConfig() {
  const { schoolId, isGlobalAdmin } = useSchool();
  const { user } = useAuth();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async (force = false) => {
    const ticket = ++requestId.current;
    if (!schoolId || !user?.id) {
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await loadCached(`school-config:${user.id}:${schoolId}`, async () => {
        const result = await supabase.from("logview_escola_config")
          .select("nome_aplicacao, logo_url, cor_primaria, cor_secundaria, versao_id")
          .eq("escola_id", schoolId).maybeSingle();
        if (result.error) throw result.error;
        return result.data;
      }, { ttl: 60_000, force });
      if (ticket === requestId.current) setConfig({ ...DEFAULT_CONFIG, ...(data || {}) });
    } catch (error) {
      console.error("Erro carregando configuração da escola:", error);
      if (ticket === requestId.current) setConfig(DEFAULT_CONFIG);
    } finally {
      if (ticket === requestId.current) setLoading(false);
    }
  }, [schoolId, user?.id]);

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  return useMemo(() => ({ config, loading, refresh: () => load(true), isGlobalAdmin }),
    [config, loading, load, isGlobalAdmin]);
}
