import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import { useSchool } from "./useSchool";

export function useSchoolFeatures() {
  const { schoolId, isGlobalAdmin } = useSchool();
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!schoolId || isGlobalAdmin) {
      setFeatures({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("logview_escola_recursos").select("recurso_id, habilitado, logview_recursos(chave)").eq("escola_id", schoolId);
    if (error) {
      console.error("Erro carregando recursos da escola:", error);
      setFeatures({});
    } else {
      const next = {};
      (data || []).forEach((item) => { if (item.logview_recursos?.chave) next[item.logview_recursos.chave] = item.habilitado; });
      setFeatures(next);
    }
    setLoading(false);
  }, [schoolId, isGlobalAdmin]);

  useEffect(() => { void load(); }, [load]);

  const hasFeature = useCallback((key) => {
    if (isGlobalAdmin) return true;
    return features[key] !== false;
  }, [features, isGlobalAdmin]);

  return useMemo(() => ({ features, hasFeature, loading, refresh: load }), [features, hasFeature, loading, load]);
}
