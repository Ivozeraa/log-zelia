import { useEffect, useMemo, useState } from "react";
import {
  FaBuilding,
  FaCheckCircle,
  FaCog,
  FaLayerGroup,
  FaLock,
  FaServer,
  FaShieldAlt,
  FaTools,
  FaUsers,
  FaArrowRight,
  FaPlus,
  FaTimes,
  FaHistory,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { PageTitle } from "../components/ui/PageTitle";
import { notify } from "../utils/notify";

const plannedFeatures = [
  { key: "ocorrencias", label: "Ocorrências", status: "active" },
  { key: "suspensoes", label: "Suspensões", status: "active" },
  { key: "horarios", label: "Horários", status: "active" },
  { key: "chamados", label: "Chamados", status: "planned" },
  { key: "relatorios", label: "Relatórios", status: "planned" },
  { key: "notificacoes", label: "Notificações", status: "active" },
];

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="rounded-xl bg-green-100 p-3 text-green-700 dark:bg-green-950/40 dark:text-green-400">
          <Icon />
        </div>
      </div>
    </div>
  );
}

export const Admin = () => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewSchool, setShowNewSchool] = useState(false);
  const [creatingSchool, setCreatingSchool] = useState(false);
  const [newSchool, setNewSchool] = useState({ nome: "", cidade: "" });
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadSchools = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("escolas")
        .select("id, nome, cidade, created_at, logview_escola_config(plano_id, logview_planos(nome))")
        .order("nome", { ascending: true });

      if (!mounted) return;

      if (error) {
        console.error("Erro ao carregar escolas:", error);
        notify.error("Não foi possível carregar as escolas.");
      } else {
        setSchools(data ?? []);
      }

      const { data: auditData } = await supabase
        .from("logview_auditoria")
        .select("id, acao, entidade, detalhes, created_at, escolas:escola_id(nome)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (mounted) setAudit(auditData || []);
      setLoading(false);
    };

    loadSchools();

    return () => {
      mounted = false;
    };
  }, []);

  const schoolCountLabel = useMemo(
    () => (loading ? "—" : String(schools.length)),
    [loading, schools.length]
  );

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

    const { data: version } = await supabase
      .from("logview_versoes")
      .select("id")
      .eq("ativa", true)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: plan } = await supabase
      .from("logview_planos")
      .select("id")
      .eq("chave", "basico")
      .eq("ativo", true)
      .maybeSingle();

    const { data: resources } = await supabase
      .from("logview_recursos")
      .select("id")
      .eq("ativo", true);

    await supabase.from("logview_escola_config").upsert({
      escola_id: school.id,
      cor_primaria: "#16a34a",
      cor_secundaria: "#0f172a",
      versao_id: version?.id || null,
      plano_id: plan?.id || null,
    });

    if (resources?.length) {
      const planResources = plan?.id
        ? await supabase.from("logview_plano_recursos").select("recurso_id, habilitado").eq("plano_id", plan.id)
        : { data: [] };

      const preset = new Map((planResources.data || []).map((item) => [item.recurso_id, item.habilitado]));
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
    setSchools((current) => [...current, school].sort((a, b) => a.nome.localeCompare(b.nome)));
    setNewSchool({ nome: "", cidade: "" });
    setShowNewSchool(false);
    setCreatingSchool(false);
    notify.success("Escola cadastrada e configurada com o plano Básico.");
  };

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageTitle
        title="Administração do LogView"
        subtitle="Gerencie a plataforma, escolas, recursos e futuras versões em um único lugar."
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FaBuilding}
          label="Escolas"
          value={schoolCountLabel}
          description="Cadastros atualmente disponíveis"
        />
        <StatCard
          icon={FaLayerGroup}
          label="Arquitetura"
          value="Multi-escola"
          description="Isolamento por escola_id"
        />
        <StatCard
          icon={FaShieldAlt}
          label="Acesso"
          value="Super Admin"
          description="Área restrita à role 1"
        />
        <StatCard
          icon={FaServer}
          label="Backend"
          value="Supabase"
          description="Banco e políticas RLS"
        />
      </section>

      <section className="mt-6 grid min-w-0 gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-700">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Escolas cadastradas</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Esta é a base para o gerenciamento multi-escola.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">
                {schools.length} cadastradas
              </span>
              <button type="button" onClick={() => setShowNewSchool(true)} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">
                <FaPlus /> Nova escola
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Carregando escolas...</div>
            ) : schools.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Nenhuma escola cadastrada.
              </div>
            ) : (
              schools.map((school) => (
                <div key={school.id} className="flex min-w-0 flex-col items-stretch gap-3 overflow-hidden p-3 sm:gap-4 sm:p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 w-full max-w-full items-start gap-3 sm:items-center sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <FaBuilding />
                    </div>
                    <div className="min-w-0 w-0 flex-1 overflow-hidden">
                      <p className="max-w-full break-words text-sm font-semibold leading-5 text-slate-900 dark:text-white sm:text-base">
                        {school.nome}
                      </p>
                      <p className="max-w-full break-words text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                        {school.cidade || "Cidade não informada"}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
                    <span className="hidden items-center gap-1.5 text-xs font-medium text-green-600 sm:flex dark:text-green-400"><FaCheckCircle /> Ativa</span>
                    <Link to={`/app/admin/escolas/${school.id}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto sm:min-w-36">
                      Configurar <FaArrowRight />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <FaTools />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <h2 className="font-semibold text-slate-900 dark:text-white">Próxima camada</h2>
              <p className="break-words text-sm text-slate-500 dark:text-slate-400">
                Recursos que serão controlados pelo Admin.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 sm:mt-5">
            {plannedFeatures.map((feature) => (
              <div
                key={feature.key}
                className="flex min-w-0 flex-col items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950"
              >
                <span className="min-w-0 max-w-full break-words text-sm font-medium text-slate-700 dark:text-slate-200">
                  {feature.label}
                </span>
                {feature.status === "active" ? (
                  <span className="inline-flex max-w-full shrink-0 items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                    <FaCheckCircle /> disponível
                  </span>
                ) : (
                  <span className="inline-flex max-w-full shrink-0 items-center gap-1 text-xs font-semibold text-slate-400">
                    <FaLock /> em preparação
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
            <div className="flex gap-3">
              <FaCog className="mt-0.5 shrink-0 text-slate-400" />
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                A administração central permite configurar identidade visual, plano, recursos, versão e usuários de cada escola.
              </p>
            </div>
          </div>
        </div>
      </section>

      {showNewSchool && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 sm:p-5">
          <form onSubmit={createSchool} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Cadastrar escola</h2>
              <button type="button" onClick={() => setShowNewSchool(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar"><FaTimes /></button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Nome da escola
                <input autoFocus value={newSchool.nome} onChange={(e) => setNewSchool({ ...newSchool, nome: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white" placeholder="Ex.: EEEP..." />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Cidade
                <input value={newSchool.cidade} onChange={(e) => setNewSchool({ ...newSchool, cidade: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white" placeholder="Ex.: Milagres-CE" />
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowNewSchool(false)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold dark:border-slate-600 dark:text-white">Cancelar</button>
              <button disabled={creatingSchool} className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{creatingSchool ? "Cadastrando..." : "Cadastrar escola"}</button>
            </div>
          </form>
        </div>
      )}



      <section className="mt-6 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 dark:border-slate-700">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><FaHistory /></div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 dark:text-white">Atividade administrativa</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Últimas alterações realizadas pelo Super Admin.</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {audit.length ? audit.map((item) => (
            <div key={item.id} className="flex min-w-0 items-start gap-3 px-4 py-3 sm:px-5">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-semibold capitalize">{item.acao}</span> {item.entidade}
                  {item.escolas?.nome ? <> em <span className="font-medium">{item.escolas.nome}</span></> : null}
                </p>
                <p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          )) : <p className="px-4 py-6 text-sm text-slate-500 sm:px-5">Nenhuma atividade registrada ainda.</p>}
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/60 dark:bg-blue-950/20">
        <div className="flex gap-3">
          <FaUsers className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="font-semibold text-blue-900 dark:text-blue-200">
              Fundação multi-escola pronta
            </h2>
            <p className="mt-1 text-sm leading-6 text-blue-800 dark:text-blue-300">
              O LogView continua usando <code>escola_id</code> como fronteira dos dados. A área de
              Super Admin agora tem um ponto central para evoluirmos o gerenciamento sem alterar o
              fluxo das escolas existentes.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};
