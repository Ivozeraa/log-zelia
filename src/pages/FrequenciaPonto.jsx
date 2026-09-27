import { useEffect, useState } from "react";
import { FaCamera, FaDoorOpen, FaSyncAlt } from "react-icons/fa";
import { FrequenciaCamera } from "./FrequenciaCamera";
import { supabase } from "../utils/supabase";
import { useSchool } from "../hooks/useSchool";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";
import { notify } from "../utils/notify";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

export const FrequenciaPonto = () => {
  const { schoolId } = useSchool();
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const [points, setPoints] = useState([]);
  const [pointId, setPointId] = useState("");
  const [access, setAccess] = useState([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!schoolId || !hasFeature("frequencia")) return;
    setError("");

    const [accessRes, pointsRes] = await Promise.all([
      supabase
        .from("registros_acesso")
        .select("id, aluno_id, tipo, metodo, registrado_em")
        .eq("data", today())
        .eq("status", "registrado")
        .eq("escola_id", schoolId)
        .order("registrado_em", { ascending: true }),
      supabase
        .from("pontos_verificacao")
        .select("id, nome, local, ativo")
        .eq("escola_id", schoolId)
        .eq("ativo", true)
        .order("nome"),
    ]);

    if (accessRes.error || pointsRes.error) {
      console.error(accessRes.error || pointsRes.error);
      setError("Não foi possível carregar o terminal de frequência.");
      return;
    }

    setAccess(accessRes.data || []);
    setPoints(pointsRes.data || []);
    setPointId((current) => current || pointsRes.data?.[0]?.id || "");
  };

  useEffect(() => {
    void load();
  }, [schoolId, featureLoading]);

  const refresh = async () => {
    if (!schoolId) return;
    setRefreshing(true);
    try {
      const { data, error: accessError } = await supabase
        .from("registros_acesso")
        .select("id, aluno_id, tipo, metodo, registrado_em")
        .eq("data", today())
        .eq("status", "registrado")
        .eq("escola_id", schoolId)
        .order("registrado_em", { ascending: true });

      if (accessError) throw accessError;
      setAccess(data || []);
    } catch (refreshError) {
      console.error(refreshError);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!schoolId || !hasFeature("frequencia")) return undefined;
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(interval);
  }, [schoolId, featureLoading]);

  const registerIdentifiedStudent = async ({ alunoId }) => {
    if (!alunoId) return;

    const studentEvents = access.filter((event) => event.aluno_id === alunoId);
    const lastEvent = studentEvents.at(-1);
    const type = lastEvent?.tipo === "entrada" ? "saida" : "entrada";

    const { data, error: rpcError } = await supabase.rpc("registrar_acesso_frequencia", {
      p_aluno_id: alunoId,
      p_tipo: type,
      p_metodo: "facial",
      p_ponto_id: pointId || null,
      p_confidence_score: null,
    });

    if (rpcError) {
      notify.error(rpcError.message || "Não foi possível registrar a frequência.");
      return;
    }

    setAccess((current) => [...current, data]);
  };

  if (featureLoading || !hasFeature("frequencia")) return null;

  return (
    <main className="min-h-screen">
      {error && (
        <div className="fixed left-1/2 top-4 z-[100000] flex w-[min(92vw,560px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-red-400/40 bg-red-950/90 px-4 py-3 text-sm text-red-100 shadow-xl">
          {error}
        </div>
      )}

      <FrequenciaCamera
        onExit={() => window.history.back()}
        points={points}
        pointId={pointId}
        onPointChange={setPointId}
        onIdentity={registerIdentifiedStudent}
      />

      <div className="fixed bottom-3 right-3 z-[100001]">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 text-xs font-semibold text-white/80 backdrop-blur-md hover:bg-black/75 disabled:opacity-50"
        >
          <FaSyncAlt className={refreshing ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>
    </main>
  );
};
