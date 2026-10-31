import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabase";
import { loadCached } from "../utils/requestCache";
import { useSchool } from "./useSchool";
import { useAuth } from "./useAuth";

export function useSchoolFeatures() {
  const { schoolId, isGlobalAdmin } = useSchool();
  const { user } = useAuth();
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async (force = false) => {
    const ticket = ++requestId.current;
    if (!schoolId || isGlobalAdmin || !user?.id) {
      setFeatures({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const key = `features:${user.id}:${schoolId}`;
    try {
      const next = await loadCached(key, async () => {
        const { data, error } = await supabase
          .from("logview_escola_recursos")
          .select("recurso_id, habilitado, logview_recursos(chave)")
          .eq("escola_id", schoolId);
        if (error) throw error;
        return Object.fromEntries((data || [])
          .filter((item) => item.logview_recursos?.chave)
          .map((item) => [item.logview_recursos.chave, item.habilitado]));
      }, { ttl: 30_000, force });
      if (ticket === requestId.current) setFeatures(next);
    } catch (error) {
      console.error("Erro carregando recursos da escola:", error);
      if (ticket === requestId.current) setFeatures({});
    } finally {
      if (ticket === requestId.current) setLoading(false);
    }
  }, [schoolId, isGlobalAdmin, user?.id]);

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  const hasFeature = useCallback((key) => {
    if (isGlobalAdmin) return true;
    return features[key] !== false;
  }, [features, isGlobalAdmin]);

  return useMemo(
    () => ({ features, hasFeature, loading, refresh: () => load(true) }),
    [features, hasFeature, loading, load],
  );
}
