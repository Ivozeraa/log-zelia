import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBuilding,
  FaCheckCircle,
  FaLayerGroup,
  FaPlus,
  FaSearch,
  FaUsers,
} from "react-icons/fa";
import {
  Box,
  Button as MuiButton,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { MuiTheme } from "../components/ui/MuiTheme";
import { supabase } from "../utils/supabase";
import { PageTitle } from "../components/ui/PageTitle";
import { notify } from "../utils/notify";

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        borderColor: "divider",
        boxShadow: "0 2px 8px rgb(15 23 42 / 0.04)",
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.25 }, "&:last-child": { pb: { xs: 2, sm: 2.25 } } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              width: 42,
              height: 42,
              flexShrink: 0,
              borderRadius: 2.5,
              bgcolor: "success.main",
              color: "success.contrastText",
            }}
          >
            <Icon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box component="p" sx={{ m: 0, color: "text.secondary", fontSize: 13, fontWeight: 600 }}>
              {label}
            </Box>
            <Box component="p" sx={{ m: "3px 0 0", color: "text.primary", fontSize: { xs: 24, sm: 26 }, lineHeight: 1.1, fontWeight: 800 }}>
              {value}
            </Box>
            <Box component="p" sx={{ m: "4px 0 0", color: "text.secondary", fontSize: 11 }}>
              {description}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export const Admin = () => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewSchool, setShowNewSchool] = useState(false);
  const [creatingSchool, setCreatingSchool] = useState(false);
  const [newSchool, setNewSchool] = useState({ nome: "", cidade: "" });
  const [schoolSearch, setSchoolSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [platformStats, setPlatformStats] = useState({ usuarios: 0, alunos: 0 });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);

      const [
        schoolsResult,
        usersResult,
        studentsResult,
      ] = await Promise.all([
        supabase
          .from("escolas")
          .select("id, nome, cidade, ativo, created_at, logview_escola_config(plano_id, logview_planos(chave, nome))")
          .order("nome", { ascending: true }),
        supabase.from("usuarios").select("id", { count: "exact", head: true }),
        supabase.from("alunos").select("id", { count: "exact", head: true }),
      ]);

      if (!mounted) return;

      if (schoolsResult.error) {
        console.error("Erro ao carregar escolas:", schoolsResult.error);
        notify.error("Não foi possível carregar as escolas.");
      } else {
        setSchools(schoolsResult.data ?? []);
      }

      setPlatformStats({
        usuarios: usersResult.count ?? 0,
        alunos: studentsResult.count ?? 0,
      });
      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const activeSchoolCount = useMemo(
    () => schools.filter((school) => school.ativo).length,
    [schools]
  );

  const planCounts = useMemo(
    () =>
      schools.reduce((acc, school) => {
        const plan = school.logview_escola_config?.[0]?.logview_planos?.nome || "Básico";
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
      }, {}),
    [schools]
  );

  const filteredSchools = useMemo(() => {
    const query = schoolSearch.trim().toLocaleLowerCase("pt-BR");

    return schools.filter((school) => {
      const name = school.nome?.toLocaleLowerCase("pt-BR") || "";
      const city = school.cidade?.toLocaleLowerCase("pt-BR") || "";
      const planKey =
        school.logview_escola_config?.[0]?.logview_planos?.chave?.toLocaleLowerCase("pt-BR") || "basico";

      const matchesSearch = !query || name.includes(query) || city.includes(query);
      const matchesPlan = planFilter === "todos" || planKey === planFilter;
      const matchesStatus =
        statusFilter === "todos" ||
        (statusFilter === "ativas" ? school.ativo : !school.ativo);

      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [schools, schoolSearch, planFilter, statusFilter]);

  const toggleSchoolStatus = async (school) => {
    const nextStatus = !school.ativo;
    const { error } = await supabase
      .from("escolas")
      .update({ ativo: nextStatus })
      .eq("id", school.id);

    if (error) {
      console.error(error);
      notify.error("Não foi possível alterar o status da escola.");
      return;
    }

    await supabase.from("logview_auditoria").insert({
      escola_id: school.id,
      acao: "alterar",
      entidade: "escola",
      entidade_id: school.id,
      detalhes: { campo: "ativo", valor: nextStatus },
    });

    setSchools((current) =>
      current.map((item) =>
        item.id === school.id ? { ...item, ativo: nextStatus } : item
      )
    );
    notify.success(nextStatus ? "Escola ativada." : "Escola desativada.");
  };

  const createSchool = async (event) => {
    event.preventDefault();

    const nome = newSchool.nome.trim();
    const cidade = newSchool.cidade.trim();

    if (!nome) {
      notify.error("Informe o nome da escola.");
      return;
    }

    setCreatingSchool(true);

    const { data: school, error } = await supabase
      .from("escolas")
      .insert({ nome, cidade: cidade || null })
      .select("id, nome, cidade, created_at")
      .single();

    if (error || !school) {
      console.error(error);
      notify.error(error?.message || "Não foi possível cadastrar a escola.");
      setCreatingSchool(false);
      return;
    }

    const [{ data: version }, { data: plan }, { data: resources }] = await Promise.all([
      supabase
        .from("logview_versoes")
        .select("id")
        .eq("ativa", true)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("logview_planos")
        .select("id")
        .eq("chave", "basico")
        .eq("ativo", true)
        .maybeSingle(),
      supabase.from("logview_recursos").select("id").eq("ativo", true),
    ]);

    await supabase.from("logview_escola_config").upsert({
      escola_id: school.id,
      cor_primaria: "#16a34a",
      cor_secundaria: "#0f172a",
      versao_id: version?.id || null,
      plano_id: plan?.id || null,
    });

    if (resources?.length) {
      const { data: planResources } = plan?.id
        ? await supabase
            .from("logview_plano_recursos")
            .select("recurso_id, habilitado")
            .eq("plano_id", plan.id)
        : { data: [] };

      const preset = new Map(
        (planResources || []).map((item) => [item.recurso_id, item.habilitado])
      );

      await supabase.from("logview_escola_recursos").upsert(
        resources.map((resource) => ({
          escola_id: school.id,
          recurso_id: resource.id,
          habilitado: preset.has(resource.id) ? preset.get(resource.id) : true,
        }))
      );
    }

    await supabase.from("logview_auditoria").insert({
      escola_id: school.id,
      acao: "criar",
      entidade: "escola",
      entidade_id: school.id,
      detalhes: { nome, cidade: cidade || null },
    });

    setSchools((current) =>
      [...current, { ...school, ativo: true }].sort((a, b) =>
        a.nome.localeCompare(b.nome)
      )
    );
    setNewSchool({ nome: "", cidade: "" });
    setShowNewSchool(false);
    setCreatingSchool(false);
    notify.success("Escola cadastrada e configurada com o plano Básico.");
  };

  const schoolCountLabel = loading ? "—" : String(schools.length);
  const activeLabel = loading ? "—" : String(activeSchoolCount);
  const inactiveCount = Math.max(0, schools.length - activeSchoolCount);

  return (
    <MuiTheme>
      <main className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <PageTitle
          title="Administração"
          subtitle="Visão central da plataforma e gerenciamento das escolas."
        />

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={FaBuilding}
            label="Escolas"
            value={schoolCountLabel}
            description={loading ? "Carregando" : `${activeSchoolCount} ativas · ${inactiveCount} inativas`}
          />
          <StatCard
            icon={FaCheckCircle}
            label="Escolas ativas"
            value={activeLabel}
            description={loading ? "Carregando" : "Com acesso liberado"}
          />
          <StatCard
            icon={FaUsers}
            label="Usuários"
            value={loading ? "—" : platformStats.usuarios}
            description={loading ? "Carregando" : "Contas cadastradas"}
          />
          <StatCard
            icon={FaLayerGroup}
            label="Alunos"
            value={loading ? "—" : platformStats.alunos}
            description="Registros na plataforma"
          />
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-700">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Escolas</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Gerencie acesso e configurações de cada escola.
                </p>
              </div>
              <MuiButton
                type="button"
                onClick={() => setShowNewSchool(true)}
                size="small"
                variant="contained"
                color="success"
                startIcon={<FaPlus />}
              >
                Nova escola
              </MuiButton>
            </div>

            <div className="border-b border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <FaSearch className="pointer-events-none absolute left-3 top-3 text-slate-400" />
                  <input
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    placeholder="Buscar escola ou cidade..."
                    className="w-full rounded-xl border border-slate-300 bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500 dark:border-slate-600 dark:text-white"
                  />
                </div>

                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:w-40"
                >
                  <option value="todos">Todos os planos</option>
                  <option value="basico">Básico</option>
                  <option value="profissional">Profissional</option>
                  <option value="enterprise">Enterprise</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:w-36"
                >
                  <option value="todos">Todos</option>
                  <option value="ativas">Ativas</option>
                  <option value="inativas">Inativas</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-500">Carregando escolas...</div>
              ) : filteredSchools.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  {schoolSearch || planFilter !== "todos" || statusFilter !== "todos"
                    ? "Nenhuma escola encontrada com esses filtros."
                    : "Nenhuma escola cadastrada."}
                </div>
              ) : (
                filteredSchools.map((school) => {
                  const planName =
                    school.logview_escola_config?.[0]?.logview_planos?.nome || "Básico";

                  return (
                    <div
                      key={school.id}
                      className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <FaBuilding />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
                            {school.nome}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>{school.cidade || "Cidade não informada"}</span>
                            <span>·</span>
                            <span>{planName}</span>
                            <span className={school.ativo ? "font-medium text-green-600 dark:text-green-400" : "font-medium text-slate-400"}>
                              · {school.ativo ? "Ativa" : "Inativa"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                        <button
                          type="button"
                          onClick={() => void toggleSchoolStatus(school)}
                          className="min-h-10 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:flex-none"
                        >
                          {school.ativo ? "Desativar" : "Ativar"}
                        </button>
                        <Link
                          to={`/app/admin/escolas/${school.id}`}
                          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 sm:flex-none"
                        >
                          Configurar
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">Planos</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Distribuição atual das escolas.
                  </p>
                </div>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${Object.keys(planCounts).length} em uso`}
                />
              </div>

              <div className="mt-4 space-y-2">
                {Object.entries(planCounts).length ? (
                  Object.entries(planCounts).map(([plan, count]) => (
                    <div
                      key={plan}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800/70"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-200">{plan}</span>
                      <span className="text-slate-500 dark:text-slate-400">{count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Nenhuma escola cadastrada.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <FaCheckCircle className="text-green-600 dark:text-green-400" />
            <span>Plataforma ativa · {savedPlatformName}</span>
          </div>
          <Link
            to="/app/admin/auditoria"
            className="text-sm font-semibold text-green-700 hover:underline dark:text-green-400"
          >
            Ver auditoria
          </Link>
        </section>

        {showNewSchool && (
          <Dialog
            open={showNewSchool}
            onClose={() => !creatingSchool && setShowNewSchool(false)}
            fullWidth
            maxWidth="sm"
          >
            <form onSubmit={createSchool}>
              <DialogTitle sx={{ fontWeight: 800 }}>Cadastrar escola</DialogTitle>
              <DialogContent dividers>
                <div className="space-y-4 pt-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Nome da escola
                    <input
                      autoFocus
                      value={newSchool.nome}
                      onChange={(e) => setNewSchool({ ...newSchool, nome: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      placeholder="Ex.: EEEP..."
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Cidade
                    <input
                      value={newSchool.cidade}
                      onChange={(e) => setNewSchool({ ...newSchool, cidade: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      placeholder="Ex.: Milagres-CE"
                    />
                  </label>
                </div>
              </DialogContent>
              <DialogActions sx={{ px: 3, py: 2 }}>
                <MuiButton
                  type="button"
                  onClick={() => setShowNewSchool(false)}
                  disabled={creatingSchool}
                >
                  Cancelar
                </MuiButton>
                <MuiButton
                  type="submit"
                  variant="contained"
                  color="success"
                  disabled={creatingSchool}
                >
                  {creatingSchool ? "Cadastrando..." : "Cadastrar escola"}
                </MuiButton>
              </DialogActions>
            </form>
          </Dialog>
        )}
      </main>
    </MuiTheme>
  );
};
