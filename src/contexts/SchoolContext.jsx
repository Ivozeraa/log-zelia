import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import { SchoolContext } from "./SchoolContextImpl";
import { useAuth } from "../hooks/useAuth";
import { canSelectSchool, resolveSchoolId } from "../utils/schoolScope";
import { debugError, debugLog, debugQuery } from "../utils/debug";

const SELECTED_SCHOOL_STORAGE_KEY = "logview:selected-school-id";

export function SchoolProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [school, setSchool] = useState(null);
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isGlobalAdmin = Number(user?.role_id) === 1 && !user?.escola_id;
  const isSchoolBound = Boolean(user?.escola_id);
  const canSwitchSchool = canSelectSchool(isGlobalAdmin);

  const loadSchools = useCallback(async () => {
    if (!isGlobalAdmin) {
      setSchools([]);
      return [];
    }

    debugLog("SCHOOL", "carregando lista global de escolas");
    const { data, error: schoolsError } = await debugQuery("SCHOOL", "listar escolas", supabase
      .from("escolas")
      .select("id, nome, cidade, ativo, created_at")
      .order("nome", { ascending: true }));

    if (schoolsError) {
      debugError("SCHOOL", "Erro ao listar escolas", schoolsError);
      throw schoolsError;
    }

    const nextSchools = data ?? [];
    setSchools(nextSchools);
    return nextSchools;
  }, [isGlobalAdmin]);

  const loadSchool = useCallback(async () => {
    if (authLoading) {
      debugLog("SCHOOL", "aguardando AuthProvider");
      return;
    }

    debugLog("SCHOOL", "iniciando carregamento do contexto", { isGlobalAdmin, escolaId: user?.escola_id });
    setLoading(true);
    setError(null);

    try {
      if (isGlobalAdmin) {
        const availableSchools = await loadSchools();
        const storedId = window.localStorage.getItem(SELECTED_SCHOOL_STORAGE_KEY);
        const storedExists = availableSchools.some((item) => String(item.id) === String(storedId));
        const nextId = storedExists ? storedId : availableSchools[0]?.id ?? null;

        setSelectedSchoolId(nextId ? String(nextId) : null);

        if (!nextId) {
          setSchool(null);
          return;
        }

        const selected = availableSchools.find((item) => String(item.id) === String(nextId)) ?? null;
        setSchool(selected);
        return;
      }

      if (!user?.escola_id) {
        setSchool(null);
        setSelectedSchoolId(null);
        setSchools([]);
        return;
      }

      // A escola já está determinada pelo perfil autenticado. Não bloqueamos
      // o restante da aplicação esperando nome/cidade: esses dados são carregados
      // em segundo plano.
      const immediateSchool = {
        id: user.escola_id,
        nome: "Escola atual",
      };

      setSchool((current) => current?.id === user.escola_id ? current : immediateSchool);
      setSelectedSchoolId(String(user.escola_id));
      setSchools((current) => current.length > 0 ? current : [immediateSchool]);
      setLoading(false);

      void debugQuery("SCHOOL", "carregar detalhes da escola", supabase
        .from("escolas")
        .select("id, nome, cidade, created_at, ativo")
        .eq("id", user.escola_id)
        .maybeSingle())
        .then(({ data, error: schoolError }) => {
          if (schoolError) {
            debugError("SCHOOL", "Erro ao carregar detalhes da escola", schoolError);
            return;
          }

          if (!data) return;
          setSchool(data);
          setSchools([data]);
        });
    } catch (loadError) {
      debugError("SCHOOL", "Erro carregando contexto de escola", loadError);
      setSchool(null);
      setSchools([]);
      setError(loadError);
    } finally {
      setLoading(false);
      debugLog("SCHOOL", "contexto de escola finalizado", { schoolId: selectedSchoolId });
    }
  }, [authLoading, isGlobalAdmin, loadSchools, user?.escola_id]);

  useEffect(() => {
    void loadSchool();
  }, [loadSchool]);

  const switchSchool = useCallback(async (requestedSchoolId) => {
    if (!canSwitchSchool) return false;

    const target = schools.find((item) => String(item.id) === String(requestedSchoolId));
    if (!target) return false;

    setSelectedSchoolId(String(target.id));
    setSchool(target);
    window.localStorage.setItem(SELECTED_SCHOOL_STORAGE_KEY, String(target.id));
    return true;
  }, [canSwitchSchool, schools]);

  const refreshSchool = useCallback(async () => {
    await loadSchool();
  }, [loadSchool]);

  const schoolId = resolveSchoolId({
    selectedSchoolId,
    schoolId: school?.id ?? user?.escola_id ?? null,
    isGlobalAdmin,
  });

  const scope = useMemo(() => ({
    schoolId,
    isGlobalAdmin,
    isSchoolBound,
    canSwitchSchool,
    requireSchoolId() {
      if (!schoolId && !isGlobalAdmin) {
        throw new Error("A conta não possui uma escola vinculada.");
      }
      return schoolId;
    },
    resolveSchoolId(requestedSchoolId = null) {
      return resolveSchoolId({
        selectedSchoolId: requestedSchoolId,
        schoolId,
        isGlobalAdmin,
      });
    },
  }), [canSwitchSchool, isGlobalAdmin, isSchoolBound, schoolId]);

  return (
    <SchoolContext.Provider
      value={{
        school,
        schools,
        selectedSchoolId,
        schoolId: scope.schoolId,
        isGlobalAdmin: scope.isGlobalAdmin,
        isSchoolBound: scope.isSchoolBound,
        canSwitchSchool: scope.canSwitchSchool,
        requireSchoolId: scope.requireSchoolId,
        resolveSchoolId: scope.resolveSchoolId,
        switchSchool,
        loading: authLoading || loading,
        error,
        refreshSchool,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}
