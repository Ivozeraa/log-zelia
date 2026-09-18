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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
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

  useEffect(() => {
    let mounted = true;

    const loadSchools = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("escolas")
        .select("id, nome, cidade, created_at")
        .order("nome", { ascending: true });

      if (!mounted) return;

      if (error) {
        console.error("Erro ao carregar escolas:", error);
        notify.error("Não foi possível carregar as escolas.");
      } else {
        setSchools(data ?? []);
      }

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

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-700">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Escolas cadastradas</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Esta é a base para o gerenciamento multi-escola.
              </p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">
              {schools.length} cadastradas
            </span>
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
                <div key={school.id} className="flex flex-col items-stretch gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 max-w-full items-center gap-3 sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <FaBuilding />
                    </div>
                    <div className="min-w-0 max-w-full flex-1 overflow-hidden">
                      <p className="max-w-full truncate font-semibold text-slate-900 dark:text-white">
                        {school.nome}
                      </p>
                      <p className="max-w-full truncate text-sm text-slate-500 dark:text-slate-400">
                        {school.cidade || "Cidade não informada"}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
                    <span className="hidden items-center gap-1.5 text-xs font-medium text-green-600 sm:flex dark:text-green-400"><FaCheckCircle /> Ativa</span>
                    <Link to={`/app/admin/escolas/${school.id}`} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none">
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

          <div className="mt-5 space-y-3">
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
                Nesta primeira etapa, a tela é somente administrativa. As configurações de logo,
                plano, recursos e versão serão persistidas em tabelas próprias antes de liberar
                alterações.
              </p>
            </div>
          </div>
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
