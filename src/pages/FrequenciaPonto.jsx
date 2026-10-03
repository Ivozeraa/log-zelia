import { useEffect, useState } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { supabase } from "../utils/supabase";
import { useSchool } from "../hooks/useSchool";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";
import { FrequenciaCamera } from "./FrequenciaCamera";

/**
 * Página do terminal de frequência: entra direto em modo terminal (tela cheia,
 * câmera sempre aberta, identificação facial automática). Não há seleção
 * manual de aluno aqui — isso agora fica só no cadastro facial (Gestão).
 */
export const FrequenciaPonto = () => {
  const { schoolId } = useSchool();
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const [points, setPoints] = useState([]);
  const [pointId, setPointId] = useState("");
  const [reconhecimentoAtivo, setReconhecimentoAtivo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!schoolId || featureLoading || !hasFeature("frequencia")) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");

      const [configRes, pointsRes] = await Promise.all([
        supabase.from("frequencia_configuracoes").select("reconhecimento_facial_ativo").eq("escola_id", schoolId).maybeSingle(),
        supabase.from("pontos_verificacao").select("id, nome, local, ativo").eq("escola_id", schoolId).eq("ativo", true).order("nome"),
      ]);

      if (configRes.error || pointsRes.error) {
        console.error(configRes.error || pointsRes.error);
        setError("Não foi possível carregar o terminal de frequência.");
        setLoading(false);
        return;
      }

      setReconhecimentoAtivo(Boolean(configRes.data?.reconhecimento_facial_ativo));
      setPoints(pointsRes.data || []);
      setPointId((current) => current || pointsRes.data?.[0]?.id || "");
      setLoading(false);
    };

    void load();
  }, [schoolId, featureLoading, hasFeature]);

  if (featureLoading || loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando terminal...</p>
      </main>
    );
  }

  if (!hasFeature("frequencia")) return null;

  if (error) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <FaExclamationTriangle className="text-3xl text-red-500" />
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{error}</p>
      </main>
    );
  }

  if (!reconhecimentoAtivo) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <PageTitle title="Terminal de frequência" subtitle="O reconhecimento facial ainda não está habilitado para esta escola." />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Peça para a Gestão habilitar o reconhecimento facial em <strong>Configurar frequência</strong> e cadastrar o rosto dos alunos antes de abrir o terminal.
        </p>
      </main>
    );
  }

  return (
    <FrequenciaCamera
      points={points}
      pointId={pointId}
      onPointChange={setPointId}
      onExit={() => window.history.back()}
    />
  );
};
