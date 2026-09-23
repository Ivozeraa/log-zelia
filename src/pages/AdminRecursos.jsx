import { useEffect, useMemo, useState } from "react";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaCog,
  FaLayerGroup,
  FaPlus,
  FaSave,
  FaTimes,
  FaTools,
  FaToggleOn,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { PageTitle } from "../components/ui/PageTitle";
import { notify } from "../utils/notify";

export const AdminRecursos = () => {
  const [resources, setResources] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planResources, setPlanResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ chave: "", nome: "", descricao: "", ativo: true });

  const load = async () => {
    setLoading(true);
    const [resourcesRes, plansRes, planResourcesRes] = await Promise.all([
      supabase.from("logview_recursos").select("id, chave, nome, descricao, ativo, created_at").order("nome"),
      supabase.from("logview_planos").select("id, chave, nome, ativo").order("preco_mensal"),
      supabase.from("logview_plano_recursos").select("plano_id, recurso_id, habilitado"),
    ]);

    const error = resourcesRes.error || plansRes.error || planResourcesRes.error;
    if (error) {
      console.error(error);
      notify.error("Não foi possível carregar os recursos.");
      setLoading(false);
      return;
    }

    setResources(resourcesRes.data || []);
    setPlans(plansRes.data || []);
    setPlanResources(planResourcesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const planMap = useMemo(() => {
    return plans.map((plan) => ({
      ...plan,
      recursos: resources.filter((resource) =>
        planResources.some((row) => row.plano_id === plan.id && row.recurso_id === resource.id && row.habilitado)
      ),
    }));
  }, [plans, resources, planResources]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ chave: "", nome: "", descricao: "", ativo: true });
    setCreating(true);
  };

  const openEdit = (resource) => {
    setEditingId(resource.id);
    setForm({
      chave: resource.chave,
      nome: resource.nome,
      descricao: resource.descricao || "",
      ativo: resource.ativo,
    });
    setCreating(true);
  };

  const saveResource = async (event) => {
    event.preventDefault();
    const chave = form.chave.trim().toLowerCase().replace(/\s+/g, "_");
    const nome = form.nome.trim();
    const descricao = form.descricao.trim();

    if (!chave || !nome) {
      notify.error("Informe a chave e o nome do recurso.");
      return;
    }

    setSavingId(editingId || "new");
    const payload = { chave, nome, descricao: descricao || null, ativo: form.ativo };
    const result = editingId
      ? await supabase.from("logview_recursos").update(payload).eq("id", editingId)
      : await supabase.from("logview_recursos").insert(payload);

    if (result.error) {
      console.error(result.error);
      notify.error(result.error.message || "Não foi possível salvar o recurso.");
      setSavingId(null);
      return;
    }

    await supabase.from("logview_auditoria").insert({
      acao: editingId ? "alterar" : "criar",
      entidade: "recurso",
      entidade_id: editingId || null,
      detalhes: { chave, nome, descricao, ativo: form.ativo },
    });

    setCreating(false);
    setSavingId(null);
    notify.success(editingId ? "Recurso atualizado." : "Recurso criado.");
    await load();
  };

  const toggleResource = async (resource) => {
    setSavingId(resource.id);
    const { error } = await supabase
      .from("logview_recursos")
      .update({ ativo: !resource.ativo })
      .eq("id", resource.id);

    if (error) {
      console.error(error);
      notify.error("Não foi possível alterar o status do recurso.");
      setSavingId(null);
      return;
    }

    await supabase.from("logview_auditoria").insert({
      acao: "alterar",
      entidade: "recurso",
      entidade_id: resource.id,
      detalhes: { campo: "ativo", anterior: resource.ativo, novo: !resource.ativo },
    });

    setSavingId(null);
    notify.success(resource.ativo ? "Recurso desativado." : "Recurso ativado.");
    await load();
  };

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
          <FaArrowLeft /> Administração
        </Link>
        <button type="button" onClick={openCreate} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
          <FaPlus /> Novo recurso
        </button>
      </div>

      <PageTitle title="Central de recursos" subtitle="Gerencie os módulos disponíveis na plataforma e visualize sua distribuição nos planos." />

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3"><FaTools className="text-green-600" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Recursos</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? "—" : resources.length}</p></div></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3"><FaCheckCircle className="text-green-600" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Ativos</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? "—" : resources.filter((r) => r.ativo).length}</p></div></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3"><FaLayerGroup className="text-green-600" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Planos</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? "—" : plans.length}</p></div></div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? <div className="p-8 text-center text-sm text-slate-500">Carregando recursos...</div> : resources.map((resource) => (
            <div key={resource.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-900 dark:text-white">{resource.nome}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">{resource.chave}</span>
                  <span className={resource.ativo ? "rounded-full bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400" : "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800"}>{resource.ativo ? "Ativo" : "Inativo"}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{resource.descricao || "Sem descrição."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {planMap.map((plan) => {
                    const enabled = plan.recursos.some((item) => item.id === resource.id);
                    return <span key={plan.id} className={enabled ? "rounded-lg bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400" : "rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-400 dark:bg-slate-800/60"}>{plan.nome}: {enabled ? "habilitado" : "não habilitado"}</span>;
                  })}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => openEdit(resource)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><FaCog /> Editar</button>
                <button type="button" disabled={savingId === resource.id} onClick={() => void toggleResource(resource)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><FaToggleOn /> {resource.ativo ? "Desativar" : "Ativar"}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {creating && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-5">
          <form onSubmit={saveResource} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingId ? "Editar recurso" : "Novo recurso"}</h2><button type="button" onClick={() => setCreating(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><FaTimes /></button></div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Chave
                <input value={form.chave} disabled={Boolean(editingId)} onChange={(e) => setForm({ ...form, chave: e.target.value })} placeholder="ex.: chamados" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-mono text-sm outline-none focus:border-green-500 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800" />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Nome
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome exibido" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Descrição
                <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Recurso ativo</label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold dark:border-slate-600 dark:text-white">Cancelar</button><button disabled={savingId !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><FaSave /> {savingId ? "Salvando..." : "Salvar recurso"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
};
