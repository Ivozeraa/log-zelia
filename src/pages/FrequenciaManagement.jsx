import { useEffect, useMemo, useState } from "react";
import { FaCamera, FaClock, FaDoorOpen, FaEdit, FaPlus, FaShieldAlt, FaTrash, FaSave } from "react-icons/fa";
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
  const [points, setPoints] = useState([]);
  const [pointLoading, setPointLoading] = useState(false);
  const [pointSaving, setPointSaving] = useState(false);
  const [editingPointId, setEditingPointId] = useState("");
  const [pointForm, setPointForm] = useState({ nome: "", local: "", device_id: "", ativo: true });

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

    const [configRes, resourceRes, pointsRes] = await Promise.all([
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
      supabase
        .from("pontos_verificacao")
        .select("id, nome, local, device_id, ativo")
        .eq("escola_id", schoolId)
        .order("nome"),
    ]);

    if (configRes.error || resourceRes.error || pointsRes.error) {
      console.error(configRes.error || resourceRes.error || pointsRes.error);
      notify.error("Não foi possível carregar as configurações de frequência.");
      setLoading(false);
      return;
    }

    setConfig({
      ...DEFAULT_CONFIG,
      ...(configRes.data || {}),
    });
    setResourceId(resourceRes.data?.id || null);
    setPoints(pointsRes.data || []);
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

  const resetPointForm = () => {
    setEditingPointId("");
    setPointForm({ nome: "", local: "", device_id: "", ativo: true });
  };

  const editPoint = (point) => {
    setEditingPointId(point.id);
    setPointForm({ nome: point.nome || "", local: point.local || "", device_id: point.device_id || "", ativo: Boolean(point.ativo) });
  };

  const savePoint = async () => {
    if (!schoolId || !canManage || !pointForm.nome.trim()) {
      notify.error("Informe o nome do ponto.");
      return;
    }
    setPointSaving(true);
    try {
      const payload = { escola_id: schoolId, nome: pointForm.nome.trim(), local: pointForm.local.trim() || null, device_id: pointForm.device_id.trim() || null, ativo: Boolean(pointForm.ativo) };
      const result = editingPointId
        ? await supabase.from("pontos_verificacao").update(payload).eq("id", editingPointId).eq("escola_id", schoolId).select("id, nome, local, device_id, ativo").single()
        : await supabase.from("pontos_verificacao").insert(payload).select("id, nome, local, device_id, ativo").single();
      if (result.error) throw result.error;
      await supabase.from("auditoria_frequencia").insert({ escola_id: schoolId, acao: editingPointId ? "alterar_ponto_verificacao" : "criar_ponto_verificacao", usuario_id: user?.id || null, detalhes: result.data });
      setPoints((current) => editingPointId ? current.map((item) => item.id === editingPointId ? result.data : item) : [...current, result.data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      resetPointForm();
      notify.success(editingPointId ? "Ponto atualizado." : "Ponto criado.");
    } catch (pointError) {
      console.error(pointError);
      notify.error(pointError.message || "Não foi possível salvar o ponto.");
    } finally {
      setPointSaving(false);
    }
  };

  const togglePoint = async (point) => {
    setPointLoading(true);
    try {
      const { data, error: pointError } = await supabase.from("pontos_verificacao").update({ ativo: !point.ativo }).eq("id", point.id).eq("escola_id", schoolId).select("id, nome, local, device_id, ativo").single();
      if (pointError) throw pointError;
      setPoints((current) => current.map((item) => item.id === point.id ? data : item));
      notify.success(data.ativo ? "Ponto ativado." : "Ponto desativado.");
    } catch (pointError) {
      console.error(pointError);
      notify.error(pointError.message || "Não foi possível alterar o ponto.");
    } finally {
      setPointLoading(false);
    }
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

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm text-slate-500">Infraestrutura</p><h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Pontos de verificação</h2><p className="mt-1 text-sm text-slate-500">Locais ou dispositivos onde a frequência será registrada.</p></div>
              <button type="button" onClick={resetPointForm} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"><FaPlus /> Novo ponto</button>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="font-semibold text-slate-900 dark:text-white">{editingPointId ? "Editar ponto" : "Novo ponto"}</p>
                <div className="mt-4 space-y-3">
                  <input value={pointForm.nome} onChange={(e) => setPointForm((v) => ({ ...v, nome: e.target.value }))} placeholder="Nome do ponto *" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
                  <input value={pointForm.local} onChange={(e) => setPointForm((v) => ({ ...v, local: e.target.value }))} placeholder="Local (ex.: Entrada principal)" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
                  <input value={pointForm.device_id} onChange={(e) => setPointForm((v) => ({ ...v, device_id: e.target.value }))} placeholder="ID do dispositivo (opcional)" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
                  <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={pointForm.ativo} onChange={(e) => setPointForm((v) => ({ ...v, ativo: e.target.checked }))} className="h-4 w-4 accent-green-600" />Ponto ativo</label>
                  <div className="flex gap-2"><button type="button" disabled={pointSaving} onClick={() => void savePoint()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><FaSave /> {pointSaving ? "Salvando..." : "Salvar"}</button>{editingPointId && <button type="button" onClick={resetPointForm} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600 dark:text-white">Cancelar</button>}</div>
                </div>
              </div>
              <div className="space-y-2">
                {points.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum ponto cadastrado.</div> : points.map((point) => (
                  <div key={point.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${point.ativo ? "bg-green-500" : "bg-slate-400"}`} /><p className="font-semibold text-slate-900 dark:text-white">{point.nome}</p></div><p className="mt-1 text-xs text-slate-500">{point.local || "Local não informado"}{point.device_id ? " · " + point.device_id : ""}</p></div>
                    <div className="flex gap-2"><button type="button" onClick={() => editPoint(point)} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold dark:border-slate-600 dark:text-white"><FaEdit /> Editar</button><button type="button" disabled={pointLoading} onClick={() => void togglePoint(point)} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold dark:border-slate-600 dark:text-white disabled:opacity-50"><FaTrash /> {point.ativo ? "Desativar" : "Ativar"}</button></div>
                  </div>
                ))}
              </div>
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
