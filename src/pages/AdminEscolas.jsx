import { useEffect, useState } from "react";
import { FaArrowLeft, FaBuilding, FaCheckCircle, FaSave } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { notify } from "../utils/notify";
import { PageTitle } from "../components/ui/PageTitle";

export const AdminEscolas = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [school, setSchool] = useState(null);
  const [versions, setVersions] = useState([]);
  const [resources, setResources] = useState([]);
  const [enabled, setEnabled] = useState({});
  const [form, setForm] = useState({ logo_url: "", cor_primaria: "#16a34a", cor_secundaria: "#0f172a", versao_id: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [schoolRes, configRes, versionRes, resourceRes, flagsRes] = await Promise.all([
        supabase.from("escolas").select("id, nome, cidade").eq("id", id).maybeSingle(),
        supabase.from("logview_escola_config").select("*").eq("escola_id", id).maybeSingle(),
        supabase.from("logview_versoes").select("id, numero, nome").eq("ativa", true).order("numero", { ascending: false }),
        supabase.from("logview_recursos").select("id, chave, nome, descricao").eq("ativo", true).order("nome"),
        supabase.from("logview_escola_recursos").select("recurso_id, habilitado").eq("escola_id", id),
      ]);
      if (!mounted) return;
      const error = schoolRes.error || configRes.error || versionRes.error || resourceRes.error || flagsRes.error;
      if (error) {
        console.error("Erro carregando configuração da escola:", error);
        notify.error("Não foi possível carregar a configuração.");
        setLoading(false);
        return;
      }
      setSchool(schoolRes.data);
      setVersions(versionRes.data || []);
      setResources(resourceRes.data || []);
      setForm({
        logo_url: configRes.data?.logo_url || "",
        cor_primaria: configRes.data?.cor_primaria || "#16a34a",
        cor_secundaria: configRes.data?.cor_secundaria || "#0f172a",
        versao_id: configRes.data?.versao_id || versionRes.data?.[0]?.id || "",
      });
      const nextEnabled = {};
      (resourceRes.data || []).forEach((r) => { nextEnabled[r.id] = true; });
      (flagsRes.data || []).forEach((r) => { nextEnabled[r.recurso_id] = r.habilitado; });
      setEnabled(nextEnabled);
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [id]);

  const save = async () => {
    if (!school) return;
    setSaving(true);
    const { error: configError } = await supabase.from("logview_escola_config").upsert({
      escola_id: id,
      logo_url: form.logo_url.trim() || null,
      cor_primaria: form.cor_primaria,
      cor_secundaria: form.cor_secundaria,
      versao_id: form.versao_id || null,
      updated_at: new Date().toISOString(),
    });
    if (configError) {
      console.error(configError);
      notify.error("Não foi possível salvar a configuração.");
      setSaving(false);
      return;
    }
    const rows = resources.map((r) => ({
      escola_id: id,
      recurso_id: r.id,
      habilitado: Boolean(enabled[r.id]),
      updated_at: new Date().toISOString(),
    }));
    const { error: flagsError } = await supabase.from("logview_escola_recursos").upsert(rows, { onConflict: "escola_id,recurso_id" });
    if (flagsError) {
      console.error(flagsError);
      notify.error("Configuração salva, mas houve erro nos recursos.");
      setSaving(false);
      return;
    }
    notify.success("Configuração da escola salva.");
    setSaving(false);
  };

  if (loading) return <main className="mx-auto w-full max-w-5xl px-4 py-6"><p className="text-sm text-slate-500">Carregando escola...</p></main>;
  if (!school) return <main className="mx-auto w-full max-w-5xl px-4 py-6"><p className="text-sm text-slate-500">Escola não encontrada.</p></main>;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <button onClick={() => navigate("/app/admin")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><FaArrowLeft /> Voltar</button>
      <PageTitle title={school.nome} subtitle={school.cidade || "Configuração da escola"} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><FaBuilding /></div><div><h2 className="font-semibold text-slate-900 dark:text-white">Identidade</h2><p className="text-sm text-slate-500 dark:text-slate-400">Personalização da escola no LogView.</p></div></div>
          <label className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-200">Logo (URL)</label>
          <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-slate-600" />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Cor primária<input type="color" value={form.cor_primaria} onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })} className="mt-2 h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-transparent p-1 dark:border-slate-600" /></label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Cor secundária<input type="color" value={form.cor_secundaria} onChange={(e) => setForm({ ...form, cor_secundaria: e.target.value })} className="mt-2 h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-transparent p-1 dark:border-slate-600" /></label>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Versão</label>
          <select value={form.versao_id} onChange={(e) => setForm({ ...form, versao_id: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white">
            <option value="">Sem versão definida</option>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.numero} — {v.nome}</option>)}
          </select>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-white">Recursos disponíveis</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Defina quais módulos esta escola pode utilizar.</p>
          <div className="mt-5 space-y-3">{resources.map((resource) => (
            <label key={resource.id} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <span><span className="block text-sm font-semibold text-slate-800 dark:text-white">{resource.nome}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{resource.descricao || "Módulo do LogView"}</span></span>
              <input type="checkbox" checked={Boolean(enabled[resource.id])} onChange={(e) => setEnabled({ ...enabled, [resource.id]: e.target.checked })} className="h-5 w-5 accent-green-600" />
            </label>
          ))}</div>
        </section>
      </div>
      <div className="mt-6 flex justify-end"><button disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"><FaSave />{saving ? "Salvando..." : "Salvar alterações"}</button></div>
    </main>
  );
};
