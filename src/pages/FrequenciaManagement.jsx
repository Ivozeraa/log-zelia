import { useEffect, useMemo, useState } from "react";
import { FaCamera, FaClock, FaDoorOpen, FaShieldAlt } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { useSchool } from "../hooks/useSchool";
import { notify } from "../utils/notify";

const DEFAULT_CONFIG = {
  habilitado: false,
  reconhecimento_facial_ativo: false,
  saida_padrao: "16:40",
  permitir_saida_antecipada: true,
  permitir_reentrada: false,
};

export const FrequenciaManagement = () => {
  const { user } = useAuth();
  const { school, schools, schoolId, isGlobalAdmin, switchSchool } = useSchool();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [resourceId, setResourceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedSchool = useMemo(
    () => schools.find((item) => String(item.id) === String(schoolId)) || school,
    [school, schoolId, schools],
  );

  const canManage = [1, 2, 3].includes(Number(user?.role_id));

  const load = async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [configRes, resourceRes] = await Promise.all([
      supabase
        .from("frequencia_configuracoes")
        .select("id, habilitado, reconhecimento_facial_ativo, saida_padrao, permitir_saida_antecipada, permitir_reentrada")
        .eq("escola_id", schoolId)
        .maybeSingle(),
      supabase
        .from("logview_recursos")
        .select("id")
        .eq("chave", "frequencia")
        .maybeSingle(),
    ]);

    if (configRes.error || resourceRes.error) {
      console.error(configRes.error || resourceRes.error);
      notify.error("Não foi possível carregar as configurações de frequência.");
      setLoading(false);
      return;
    }

    setConfig({
      ...DEFAULT_CONFIG,
      ...(configRes.data || {}),
    });
    setResourceId(resourceRes.data?.id || null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [schoolId]);

  const updateResource = async (habilitado) => {
    if (!resourceId || !schoolId) return;

    const { error } = await supabase
      .from("logview_escola_recursos")
      .update({ habilitado })
      .eq("escola_id", schoolId)
      .eq("recurso_id", resourceId);

    if (error) throw error;
  };

  const save = async () => {
    if (!schoolId || !canManage) return;

    setSaving(true);

    try {
      await updateResource(Boolean(config.habilitado));

      const payload = {
        escola_id: schoolId,
        habilitado: Boolean(config.habilitado),
        reconhecimento_facial_ativo: Boolean(config.reconhecimento_facial_ativo && config.habilitado),
        saida_padrao: config.saida_padrao || "16:40",
        permitir_saida_antecipada: Boolean(config.permitir_saida_antecipada),
        permitir_reentrada: Boolean(config.permitir_reentrada),
        updated_by: user?.id || null,
      };

      const { error } = await supabase
        .from("frequencia_configuracoes")
        .upsert(payload, { onConflict: "escola_id" });

      if (error) throw error;

      await supabase.from("auditoria_frequencia").insert({
        escola_id: schoolId,
        acao: "alterar_configuracao",
        usuario_id: user?.id || null,
        detalhes: payload,
      });

      notify.success("Configurações de frequência salvas.");
      await load();
    } catch (error) {
      console.error(error);
      notify.error(error.message || "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return null;

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <PageTitle
        title="Frequência"
        subtitle="Configure o controle diário de entrada e saída da escola."
      />

      {isGlobalAdmin && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Escola
          </label>
          <select
            value={schoolId || ""}
            onChange={(event) => void switchSchool(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          >
            {schools.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Carregando configuração...
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Escola selecionada</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {selectedSchool?.nome || "Escola"}
                </h2>
              </div>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(config.habilitado)}
                  onChange={(event) => setConfig((current) => ({ ...current, habilitado: event.target.checked }))}
                  className="h-5 w-5 accent-green-600"
                />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Habilitar frequência
                </span>
              </label>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <FaClock /> Saída padrão
                </span>
                <input
                  type="time"
                  value={config.saida_padrao}
                  onChange={(event) => setConfig((current) => ({ ...current, saida_padrao: event.target.value }))}
                  disabled={!config.habilitado}
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Alunos que permanecerem presentes até esse horário recebem encerramento automático.
                </p>
              </label>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <FaDoorOpen /> Saída antecipada
                </span>
                <label className="mt-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(config.permitir_saida_antecipada)}
                    onChange={(event) => setConfig((current) => ({ ...current, permitir_saida_antecipada: event.target.checked }))}
                    disabled={!config.habilitado}
                    className="mt-1 h-4 w-4 accent-green-600"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Permitir que o aluno registre saída antes do horário padrão.
                  </span>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <FaCamera /> Reconhecimento facial
                </span>
                <label className="mt-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(config.reconhecimento_facial_ativo)}
                    onChange={(event) => setConfig((current) => ({ ...current, reconhecimento_facial_ativo: event.target.checked }))}
                    disabled={!config.habilitado}
                    className="mt-1 h-4 w-4 accent-green-600"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Preparar o módulo para validação facial. O motor biométrico ainda será conectado na próxima etapa.
                  </span>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <FaShieldAlt /> Reentrada
                </span>
                <label className="mt-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(config.permitir_reentrada)}
                    onChange={(event) => setConfig((current) => ({ ...current, permitir_reentrada: event.target.checked }))}
                    disabled={!config.habilitado}
                    className="mt-1 h-4 w-4 accent-green-600"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Permitir nova entrada após uma saída registrada no mesmo dia.
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !schoolId}
                className="min-h-11 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar configurações"}
              </button>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-900/50 dark:bg-green-950/20">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Regra atual</p>
              <p className="mt-2 text-3xl font-black text-green-900 dark:text-green-200">
                {config.saida_padrao || "16:40"}
              </p>
              <p className="mt-1 text-sm text-green-800/80 dark:text-green-300/80">
                encerramento automático padrão
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="font-bold text-slate-900 dark:text-white">Próxima etapa</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Conectar o ponto de verificação à câmera, cadastrar o template facial dos alunos e registrar os eventos de entrada/saída com prova de vida.
              </p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
};
