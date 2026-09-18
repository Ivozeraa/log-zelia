import { useEffect, useState } from "react";
import { FaArrowLeft, FaBuilding, FaCheckCircle, FaSave, FaUsers, FaGraduationCap } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { notify } from "../utils/notify";
import { PageTitle } from "../components/ui/PageTitle";

export const AdminEscolas = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [school, setSchool] = useState(null);
  const [versions, setVersions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planResources, setPlanResources] = useState([]);
  const [resources, setResources] = useState([]);
  const [enabled, setEnabled] = useState({});
  const [stats, setStats] = useState({ usuarios: 0, alunos: 0 });
  const [users, setUsers] = useState([]);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ nome: "", email: "", password: "", role_id: "4", pdt: false });
  const [creatingUser, setCreatingUser] = useState(false);
  const [form, setForm] = useState({ nome: "", cidade: "", logo_url: "", cor_primaria: "#16a34a", cor_secundaria: "#0f172a", versao_id: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [schoolRes, configRes, versionRes, resourceRes, flagsRes, usersRes, studentsRes, planRes, usersListRes] = await Promise.all([
        supabase.from("escolas").select("id, nome, cidade").eq("id", id).maybeSingle(),
        supabase.from("logview_escola_config").select("*").eq("escola_id", id).maybeSingle(),
        supabase.from("logview_versoes").select("id, numero, nome").eq("ativa", true).order("numero", { ascending: false }),
        supabase.from("logview_recursos").select("id, chave, nome, descricao").eq("ativo", true).order("nome"),
        supabase.from("logview_escola_recursos").select("recurso_id, habilitado").eq("escola_id", id),
        supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("escola_id", id),
        supabase.from("alunos").select("id", { count: "exact", head: true }).eq("escola_id", id),
        supabase.from("logview_planos").select("id, chave, nome, descricao, preco_mensal").eq("ativo", true).order("preco_mensal"),
        supabase.from("usuarios").select("id, nome, email, role_id, pdt, created_at").eq("escola_id", id).order("nome"),
      ]);
      if (!mounted) return;
      const error = schoolRes.error || configRes.error || versionRes.error || resourceRes.error || flagsRes.error || usersRes.error || studentsRes.error || planRes.error || usersListRes.error;
      if (error) {
        console.error("Erro carregando configuração da escola:", error);
        notify.error("Não foi possível carregar a configuração.");
        setLoading(false);
        return;
      }
      setSchool(schoolRes.data);
      setStats({ usuarios: usersRes.count ?? 0, alunos: studentsRes.count ?? 0 });
      setUsers(usersListRes.data || []);
      setVersions(versionRes.data || []);
      setPlans(planRes.data || []);
      setResources(resourceRes.data || []);
      setForm({
        nome: schoolRes.data?.nome || "",
        cidade: schoolRes.data?.cidade || "",
        logo_url: configRes.data?.logo_url || "",
        cor_primaria: configRes.data?.cor_primaria || "#16a34a",
        cor_secundaria: configRes.data?.cor_secundaria || "#0f172a",
        versao_id: configRes.data?.versao_id || versionRes.data?.[0]?.id || "",
        plano_id: configRes.data?.plano_id || planRes.data?.[0]?.id || "",
      });
      const nextEnabled = {};
      (resourceRes.data || []).forEach((r) => { nextEnabled[r.id] = true; });
      (flagsRes.data || []).forEach((r) => { nextEnabled[r.recurso_id] = r.habilitado; });
      setEnabled(nextEnabled);
      const selectedPlanId = configRes.data?.plano_id || planRes.data?.[0]?.id || "";
      if (selectedPlanId) {
        const { data: selectedPlanResources } = await supabase.from("logview_plano_recursos").select("recurso_id, habilitado").eq("plano_id", selectedPlanId);
        setPlanResources(selectedPlanResources || []);
      }

      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [id]);

  const handlePlanChange = async (planId) => {
    setForm((current) => ({ ...current, plano_id: planId }));
    const { data } = await supabase.from("logview_plano_recursos").select("recurso_id, habilitado").eq("plano_id", planId);
    setPlanResources(data || []);
    if (data?.length) {
      const next = { ...enabled };
      data.forEach((item) => { next[item.recurso_id] = item.habilitado; });
      setEnabled(next);
    }
  };

  const roleLabel = (roleId) => ({ 2: "Diretor", 3: "Coordenador", 4: "Professor" })[Number(roleId)] || "Perfil desconhecido";

  const updateUserRole = async (userId, roleId) => {
    const { error } = await supabase.from("usuarios").update({ role_id: Number(roleId) }).eq("id", userId).eq("escola_id", id);
    if (error) {
      console.error(error);
      notify.error("Não foi possível alterar o perfil.");
      return;
    }
    setUsers((current) => current.map((item) => item.id === userId ? { ...item, role_id: Number(roleId) } : item));
    notify.success("Perfil do usuário atualizado.");
  };

  const createUser = async (event) => {
    event.preventDefault();
    if (!newUser.nome.trim() || !newUser.email.trim() || !newUser.password) {
      notify.error("Preencha nome, e-mail e senha.");
      return;
    }
    setCreatingUser(true);
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { ...newUser, nome: newUser.nome.trim(), email: newUser.email.trim().toLowerCase(), role_id: Number(newUser.role_id), escola_id: id },
    });
    if (error || data?.error) {
      console.error(error || data?.error);
      notify.error(data?.error || error?.message || "Não foi possível criar o usuário.");
      setCreatingUser(false);
      return;
    }
    setUsers((current) => [...current, data.user].sort((a, b) => a.nome.localeCompare(b.nome)));
    setStats((current) => ({ ...current, usuarios: current.usuarios + 1 }));
    setNewUser({ nome: "", email: "", password: "", role_id: "4", pdt: false });
    setShowNewUser(false);
    setCreatingUser(false);
    notify.success("Usuário criado com acesso à escola.");
  };

  const save = async () => {
    if (!school) return;
    setSaving(true);
    const { error: schoolError } = await supabase.from("escolas").update({
      nome: form.nome.trim(),
      cidade: form.cidade.trim() || null,
    }).eq("id", id);
    if (schoolError) {
      console.error(schoolError);
      notify.error("Não foi possível salvar os dados da escola.");
      setSaving(false);
      return;
    }
    setSchool((current) => ({ ...current, nome: form.nome.trim(), cidade: form.cidade.trim() || null }));

    const { error: configError } = await supabase.from("logview_escola_config").upsert({
      escola_id: id,
      logo_url: form.logo_url.trim() || null,
      cor_primaria: form.cor_primaria,
      cor_secundaria: form.cor_secundaria,
      versao_id: form.versao_id || null,
      plano_id: form.plano_id || null,
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
    <main className="mx-auto w-full max-w-5xl min-w-0 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <button onClick={() => navigate("/app/admin")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><FaArrowLeft /> Voltar</button>
      <div className="min-w-0"><PageTitle title={school.nome} subtitle={school.cidade || "Configuração da escola"} /></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-3"><FaUsers className="text-slate-500" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Usuários</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.usuarios}</p></div></div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-3"><FaGraduationCap className="text-slate-500" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Alunos</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.alunos}</p></div></div></div>
      </div>
      <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><FaBuilding /></div><div><h2 className="font-semibold text-slate-900 dark:text-white">Identidade</h2><p className="text-sm text-slate-500 dark:text-slate-400">Personalização da escola no LogView.</p></div></div>
          <label className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-200">Nome da escola<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-slate-600" /></label>
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Cidade<input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-slate-600" /></label>
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Logo (URL)</label>
          <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-slate-600" />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Cor primária<input type="color" value={form.cor_primaria} onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })} className="mt-2 h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-transparent p-1 dark:border-slate-600" /></label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Cor secundária<input type="color" value={form.cor_secundaria} onChange={(e) => setForm({ ...form, cor_secundaria: e.target.value })} className="mt-2 h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-transparent p-1 dark:border-slate-600" /></label>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Plano<select value={form.plano_id || ""} onChange={(e) => void handlePlanChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"><option value="">Sem plano</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.nome} — {Number(p.preco_mensal) === 0 ? "Grátis" : `R$ ${Number(p.preco_mensal).toFixed(2).replace(".", ",")}/mês`}</option>)}</select></label>
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
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-slate-900 dark:text-white">Usuários da escola</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gerencie os perfis vinculados a esta escola.</p></div>
          <button onClick={() => setShowNewUser((v) => !v)} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">{showNewUser ? "Cancelar" : "Novo usuário"}</button>
        </div>
        {showNewUser && (
          <form onSubmit={createUser} className="mt-5 grid min-w-0 gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2 sm:p-4">
            <input required value={newUser.nome} onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })} placeholder="Nome completo" className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" />
            <input required type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="E-mail" className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" />
            <input required minLength={6} type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Senha inicial" className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" />
            <select value={newUser.role_id} onChange={(e) => setNewUser({ ...newUser, role_id: e.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"><option value="2">Diretor</option><option value="3">Coordenador</option><option value="4">Professor</option></select>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={newUser.pdt} onChange={(e) => setNewUser({ ...newUser, pdt: e.target.checked })} className="h-4 w-4 accent-green-600" /> Professor PDT</label>
            <button disabled={creatingUser} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">{creatingUser ? "Criando..." : "Criar usuário"}</button>
          </form>
        )}
        <div className="mt-5 -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700"><th className="px-3 py-3">Nome</th><th className="px-3 py-3">E-mail</th><th className="px-3 py-3">Perfil</th><th className="px-3 py-3">PDT</th></tr></thead>
            <tbody>{users.map((item) => <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-3 py-3 font-medium text-slate-800 dark:text-white">{item.nome}</td>
              <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{item.email || "—"}</td>
              <td className="px-3 py-3"><select value={item.role_id} onChange={(e) => void updateUserRole(item.id, e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"><option value="2">Diretor</option><option value="3">Coordenador</option><option value="4">Professor</option></select></td>
              <td className="px-3 py-3">{item.pdt ? "Sim" : "Não"}</td>
            </tr>)}</tbody>
          </table>
          {!users.length && <p className="py-6 text-center text-sm text-slate-500">Nenhum usuário vinculado a esta escola.</p>}
        </div>
      </section>
      <div className="mt-6 flex justify-stretch sm:justify-end"><button disabled={saving} onClick={save} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"><FaSave />{saving ? "Salvando..." : "Salvar alterações"}</button></div>
    </main>
  );
};
