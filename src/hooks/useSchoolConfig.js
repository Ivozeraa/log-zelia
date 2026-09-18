import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import { useSchool } from "./useSchool";

const DEFAULT_CONFIG = {
  logo_url: "",
  cor_primaria: "#16a34a",
  cor_secundaria: "#0f172a",
  versao_id: null,
};

export function useSchoolConfig() {
  const { schoolId, isGlobalAdmin } = useSchool();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!schoolId) {
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("logview_escola_config")
      .select("logo_url, cor_primaria, cor_secundaria, versao_id")
      .eq("escola_id", schoolId)
      .maybeSingle();

    if (error) {
      console.error("Erro carregando configuração da escola:", error);
      setConfig(DEFAULT_CONFIG);
    } else {
      setConfig({ ...DEFAULT_CONFIG, ...(data || {}) });
    }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(() => ({
    config,
    loading,
    refresh: load,
    isGlobalAdmin,
  }), [config, loading, load, isGlobalAdmin]);
}
