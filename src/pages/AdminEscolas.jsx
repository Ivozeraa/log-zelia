import { useEffect, useState } from "react";
import { FaArrowLeft, FaBuilding, FaCheckCircle, FaSave, FaUsers, FaGraduationCap, FaUpload, FaTimes, FaHistory, FaPowerOff, FaChartPie, FaLayerGroup } from "react-icons/fa";
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
  const [audit, setAudit] = useState([]);
  const [users, setUsers] = useState([]);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ nome: "", email: "", password: "", role_id: "4", pdt: false });
  const [creatingUser, setCreatingUser] = useState(false);
  const [form, setForm] = useState({ nome: "", cidade: "", nome_aplicacao: "LogView", logo_url: "", cor_primaria: "#16a34a", cor_secundaria: "#0f172a", versao_id: "", plano_id: "", ativo: true });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const enabledCount = resources.filter((resource) => Boolean(enabled[resource.id])).length;
  const roleCounts = users.reduce((acc, user) => {
    const role = Number(user.role_id);
    if (role === 2) acc.diretores += 1;
    else if (role === 3) acc.coordenadores += 1;
    else if (role === 4) acc.professores += 1;
    return acc;
  }, { diretores: 0, coordenadores: 0, professores: 0 });
  const selectedPlan = plans.find((plan) => plan.id === form.plano_id);
  const enabledResources = resources.filter((resource) => Boolean(enabled[resource.id]));
  const disabledResources = resources.filter((resource) => !enabled[resource.id]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [schoolRes, configRes, versionRes, resourceRes, flagsRes, usersRes, studentsRes, planRes, usersListRes, auditRes] = await Promise.all([
        supabase.from("escolas").select("id, nome, cidade, ativo").eq("id", id).maybeSingle(),
        supabase.from("logview_escola_config").select("*").eq("escola_id", id).maybeSingle(),
        supabase.from("logview_versoes").select("id, numero, nome").eq("ativa", true).order("numero", { ascending: false }),
        supabase.from("logview_recursos").select("id, chave, nome, descricao").eq("ativo", true).order("nome"),
        supabase.from("logview_escola_recursos").select("recurso_id, habilitado").eq("escola_id", id),
        supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("escola_id", id),
        supabase.from("alunos").select("id", { count: "exact", head: true }).eq("escola_id", id),
        supabase.from("logview_planos").select("id, chave, nome, descricao, preco_mensal").eq("ativo", true).order("preco_mensal"),
        supabase.from("usuarios").select("id, nome, email, role_id, pdt, created_at").eq("escola_id", id).order("nome"),
        supabase.from("logview_auditoria").select("id, acao, entidade, detalhes, created_at").eq("escola_id", id).order("created_at", { ascending: false }).limit(12),
      ]);
      if (!mounted) return;
      const error = schoolRes.error || configRes.error || versionRes.error || resourceRes.error || flagsRes.error || usersRes.error || studentsRes.error || planRes.error || usersListRes.error || auditRes.error;
      if (error) {
        console.error("Erro carregando configuração da escola:", error);
        notify.error("Não foi possível carregar a configuração.");
        setLoading(false);
        return;
      }
      setSchool(schoolRes.data);
      setStats({ usuarios: usersRes.count ?? 0, alunos: studentsRes.count ?? 0 });
      setUsers(usersListRes.data || []);
      setAudit(auditRes.data || []);
      setVersions(versionRes.data || []);
      setPlans(planRes.data || []);
      setResources(resourceRes.data || []);
      setForm({
        nome: schoolRes.data?.nome || "",
        cidade: schoolRes.data?.cidade || "",
        nome_aplicacao: configRes.data?.nome_aplicacao || "LogView",
        logo_url: configRes.data?.logo_url || "",
        cor_primaria: configRes.data?.cor_primaria || "#16a34a",
        cor_secundaria: configRes.data?.cor_secundaria || "#0f172a",
        versao_id: configRes.data?.versao_id || versionRes.data?.[0]?.id || "",
        plano_id: configRes.data?.plano_id || planRes.data?.[0]?.id || "",
        ativo: schoolRes.data?.ativo !== false,
      });
      setLogoPreview(configRes.data?.logo_url || "");
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

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      notify.error("Envie a logo em PNG, JPG ou WEBP.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      notify.error("A logo deve ter no máximo 2 MB.");
      event.target.value = "";
      return;
    }

    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreview(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    setLogoFile(null);
    setRemoveLogo(true);
    setLogoPreview("");
  };

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
    await supabase.from("logview_auditoria").insert({
      escola_id: id,
      acao: "alterar",
      entidade: "usuario",
      entidade_id: userId,
      detalhes: { campo: "role_id", valor: Number(roleId) },
    });
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
    await supabase.from("logview_auditoria").insert({
      escola_id: id,
      acao: "criar",
      entidade: "usuario",
      entidade_id: data.user?.id || null,
      detalhes: { nome: newUser.nome.trim(), email: newUser.email.trim().toLowerCase(), role_id: Number(newUser.role_id), pdt: Boolean(newUser.pdt) },
    });
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

    let logoUrl = form.logo_url.trim() || null;
    const previousLogoUrl = form.logo_url.trim() || null;
    let uploadedLogoPath = null;

    if (removeLogo) {
      logoUrl = null;
    }

    if (logoFile) {
      const extension = logoFile.name.split(".").pop()?.toLowerCase() || "png";
      uploadedLogoPath = `${id}/logo-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("school-logos")
        .upload(uploadedLogoPath, logoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: logoFile.type,
        });

      if (uploadError) {
        console.error(uploadError);
        notify.error("Não foi possível enviar a logo.");
        setSaving(false);
        return;
      }

      const { data: publicData } = supabase.storage.from("school-logos").getPublicUrl(uploadedLogoPath);
      logoUrl = publicData?.publicUrl || null;

      if (!logoUrl) {
        await supabase.storage.from("school-logos").remove([uploadedLogoPath]);
        notify.error("Não foi possível gerar o endereço da logo.");
        setSaving(false);
        return;
      }
    }
    const { error: schoolError } = await supabase.from("escolas").update({
      nome: form.nome.trim(),
      cidade: form.cidade.trim() || null,
      ativo: Boolean(form.ativo),
    }).eq("id", id);
    if (schoolError) {
      console.error(schoolError);
      notify.error("Não foi possível salvar os dados da escola.");
      setSaving(false);
      return;
    }
    setSchool((current) => ({ ...current, nome: form.nome.trim(), cidade: form.cidade.trim() || null, ativo: Boolean(form.ativo) }));

    const { error: configError } = await supabase.from("logview_escola_config").upsert({
      escola_id: id,
      nome_aplicacao: form.nome_aplicacao.trim() || "LogView",
      logo_url: logoUrl,
      cor_primaria: form.cor_primaria,
      cor_secundaria: form.cor_secundaria,
      versao_id: form.versao_id || null,
      plano_id: form.plano_id || null,
      updated_at: new Date().toISOString(),
    });
    if (configError) {
      console.error(configError);
      if (uploadedLogoPath) await supabase.storage.from("school-logos").remove([uploadedLogoPath]);
      notify.error("Não foi possível salvar a configuração.");
      setSaving(false);
      return;
    }

    const extractLogoPath = (url) => {
      if (!url) return null;
      const marker = "/storage/v1/object/public/school-logos/";
      const index = url.indexOf(marker);
      return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
    };

    const previousLogoPath = extractLogoPath(previousLogoUrl);
    if ((logoFile || removeLogo) && previousLogoPath && previousLogoPath !== uploadedLogoPath) {
      const { error: removeError } = await supabase.storage.from("school-logos").remove([previousLogoPath]);
      if (removeError) console.warn("Não foi possível remover a logo anterior:", removeError);
    }

    setForm((current) => ({ ...current, logo_url: logoUrl }));
    setLogoFile(null);
    setRemoveLogo(false);
    setLogoPreview(logoUrl || "");
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
    await supabase.from("logview_auditoria").insert({
      escola_id: id,
      acao: "alterar",
      entidade: "configuracao",
      entidade_id: id,
      detalhes: {
        nome: form.nome.trim(),
        cidade: form.cidade.trim() || null,
        ativo: Boolean(form.ativo),
        plano_id: form.plano_id || null,
        versao_id: form.versao_id || null,
        logo_alterada: Boolean(logoFile || removeLogo),
        recursos_atualizados: true,
      },
    });
    const { data: auditRows } = await supabase.from("logview_auditoria").select("id, acao, entidade, detalhes, created_at").eq("escola_id", id).order("created_at", { ascending: false }).limit(12);
    setAudit(auditRows || []);
    notify.success("Configuração da escola salva.");
    setSaving(false);
  };

  if (loading) return <main className="mx-auto w-full max-w-5xl px-4 py-6"><p className="text-sm text-slate-500">Carregando escola...</p></main>;
  if (!school) return <main className="mx-auto w-full max-w-5xl px-4 py-6"><p className="text-sm text-slate-500">Escola não encontrada.</p></main>;

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <button onClick={() => navigate("/app/admin")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><FaArrowLeft /> Voltar</button>
      <div className="min-w-0"><PageTitle title={school.nome} subtitle={school.cidade || "Configuração da escola"} /></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-3"><FaUsers className="text-slate-500" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Usuários</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.usuarios}</p></div></div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-3"><FaGraduationCap className="text-slate-500" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Alunos</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.alunos}</p></div></div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-3"><FaChartPie className="text-slate-500" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Equipe</p><p className="text-lg font-bold text-slate-900 dark:text-white">{roleCounts.professores} prof.</p><p className="text-xs text-slate-400">{roleCounts.diretores} dir. · {roleCounts.coordenadores} coord.</p></div></div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-3"><FaLayerGroup className="text-slate-500" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Recursos</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{enabledCount}/{resources.length}</p><p className="text-xs text-slate-400">habilitados</p></div></div></div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Plano atual</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{selectedPlan?.nome || "Sem plano"}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${form.ativo ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{form.ativo ? "Ativa" : "Inativa"}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-400">Mensalidade</p><p className="mt-1 font-semibold text-slate-800 dark:text-white">{selectedPlan ? (Number(selectedPlan.preco_mensal) === 0 ? "Grátis" : `R$ ${Number(selectedPlan.preco_mensal).toFixed(2).replace(".", ",")}/mês`) : "—"}</p></div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-400">Recursos do plano</p><p className="mt-1 font-semibold text-slate-800 dark:text-white">{planResources.filter((item) => item.habilitado).length}/{planResources.length}</p></div>
          </div>
          {selectedPlan?.descricao && <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{selectedPlan.descricao}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Distribuição da equipe</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{stats.usuarios} usuários vinculados</p></div><FaChartPie className="text-slate-400" /></div>
          <div className="mt-4 space-y-3">
            {[["Diretores", roleCounts.diretores], ["Coordenadores", roleCounts.coordenadores], ["Professores", roleCounts.professores]].map(([label, count]) => {
              const percentage = stats.usuarios ? Math.round((count / stats.usuarios) * 100) : 0;
              return <div key={label}><div className="flex justify-between text-xs"><span className="font-medium text-slate-600 dark:text-slate-300">{label}</span><span className="text-slate-400">{count} · {percentage}%</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-green-500" style={{ width: `${percentage}%` }} /></div></div>;
            })}
          </div>
        </div>
      </div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className={`rounded-xl p-3 ${form.ativo ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}><FaPowerOff /></div><div><h2 className="font-semibold text-slate-900 dark:text-white">Status da escola</h2><p className="text-sm text-slate-500 dark:text-slate-400">Controle se a escola está ativa na plataforma.</p></div></div>
          <button type="button" onClick={() => setForm((current) => ({ ...current, ativo: !current.ativo }))} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${form.ativo ? "bg-green-600 hover:bg-green-700" : "bg-slate-600 hover:bg-slate-700"}`}><FaPowerOff /> {form.ativo ? "Escola ativa" : "Escola inativa"}</button>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">A alteração é aplicada ao clicar em “Salvar alterações”.</p>
      </section>
      <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><FaBuilding /></div><div><h2 className="font-semibold text-slate-900 dark:text-white">Identidade</h2><p className="text-sm text-slate-500 dark:text-slate-400">Personalização da escola no LogView.</p></div></div>
          <label className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-200">Nome da escola<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-slate-600" /></label>
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Nome exibido no cabeçalho<input value={form.nome_aplicacao} onChange={(e) => setForm({ ...form, nome_aplicacao: e.target.value })} maxLength={40} placeholder="Ex.: LogZélia" className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-slate-600" /><span className="mt-1 block text-xs font-normal text-slate-400">Este nome será usado somente nesta escola. Ex.: LogZélia.</span></label>
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Cidade<input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-slate-600" /></label>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Logo da escola</label>
            <div className="mt-2 flex min-w-0 flex-col gap-3 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-600 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                {logoPreview ? (
                  <img src={logoPreview} alt="Prévia da logo" className="h-full w-full object-contain p-2" />
                ) : (
                  <FaBuilding className="text-2xl text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Envie a imagem da escola</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PNG, JPG ou WEBP • até 2 MB</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">
                    <FaUpload />
                    {logoFile ? "Trocar logo" : "Selecionar logo"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} className="hidden" />
                  </label>
                  {logoPreview && (
                    <button type="button" onClick={clearLogo} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                      <FaTimes />
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
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
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-green-50 p-3 text-xs text-green-800 dark:bg-green-950/20 dark:text-green-300"><span className="font-semibold">{enabledResources.length}</span> recursos ativos nesta escola.</div>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300"><span className="font-semibold">{disabledResources.length}</span> recursos desativados.</div>
          </div>
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
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700"><FaHistory className="text-slate-500" /><div><h2 className="font-semibold text-slate-900 dark:text-white">Histórico da escola</h2><p className="text-sm text-slate-500 dark:text-slate-400">Alterações administrativas recentes.</p></div></div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">{audit.length ? audit.map((item) => <div key={item.id} className="flex gap-3 px-5 py-3"><div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-500" /><div className="min-w-0"><p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-semibold capitalize">{item.acao}</span> {item.entidade}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString("pt-BR")}</p></div></div>) : <p className="px-5 py-6 text-sm text-slate-500">Nenhuma alteração registrada.</p>}</div>
      </section>
      <div className="mt-6 flex justify-stretch sm:justify-end"><button disabled={saving} onClick={save} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"><FaSave />{saving ? "Salvando..." : "Salvar alterações"}</button></div>
    </main>
  );
};
