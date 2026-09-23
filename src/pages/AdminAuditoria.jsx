import { useEffect, useMemo, useState } from "react";
import {
  FaArrowLeft,
  FaBuilding,
  FaChevronDown,
  FaFilter,
  FaHistory,
  FaSearch,
  FaSyncAlt,
  FaUser,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { PageTitle } from "../components/ui/PageTitle";
import { notify } from "../utils/notify";

const PAGE_SIZE = 100;

const actionLabels = {
  criar: "Criar",
  alterar: "Alterar",
  atualizar: "Atualizar",
  excluir: "Excluir",
  remover: "Remover",
};

const entityLabels = {
  escola: "Escola",
  usuario: "Usuário",
  configuracao: "Configuração",
  recurso: "Recurso",
  plano: "Plano",
  versao: "Versão",
};

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function DetailRow({ label, value }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2 last:border-b-0 dark:border-slate-800 sm:grid-cols-[180px_minmax(0,1fr)]">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className="break-words text-sm text-slate-700 dark:text-slate-200">{formatValue(value)}</span>
    </div>
  );
}

export const AdminAuditoria = () => {
  const [entries, setEntries] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("todos");
  const [actionFilter, setActionFilter] = useState("todos");
  const [entityFilter, setEntityFilter] = useState("todos");
  const [expandedId, setExpandedId] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const load = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    const [auditRes, schoolsRes] = await Promise.all([
      supabase
        .from("logview_auditoria")
        .select("id, escola_id, usuario_id, acao, entidade, entidade_id, detalhes, created_at, escolas:escola_id(nome), usuarios:usuario_id(nome, email)")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1),
      supabase.from("escolas").select("id, nome").order("nome"),
    ]);

    if (auditRes.error || schoolsRes.error) {
      console.error(auditRes.error || schoolsRes.error);
      notify.error("Não foi possível carregar a auditoria.");
      setEntries([]);
      setSchools(schoolsRes.data || []);
      setHasMore(false);
    } else {
      const rows = auditRes.data || [];
      setHasMore(rows.length > PAGE_SIZE);
      setEntries(rows.slice(0, PAGE_SIZE));
      setSchools(schoolsRes.data || []);
    }

    if (silent) setRefreshing(false);
    else setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");

    return entries.filter((entry) => {
      const schoolName = entry.escolas?.nome || "";
      const userName = entry.usuarios?.nome || "";
      const userEmail = entry.usuarios?.email || "";
      const details = JSON.stringify(entry.detalhes || {});
      const haystack = [
        entry.acao,
        entry.entidade,
        entry.entidade_id,
        schoolName,
        userName,
        userEmail,
        details,
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");

      return (
        (!query || haystack.includes(query)) &&
        (schoolFilter === "todos" || entry.escola_id === schoolFilter) &&
        (actionFilter === "todos" || entry.acao === actionFilter) &&
        (entityFilter === "todos" || entry.entidade === entityFilter)
      );
    });
  }, [entries, search, schoolFilter, actionFilter, entityFilter]);

  const actions = useMemo(
    () => [...new Set(entries.map((entry) => entry.acao).filter(Boolean))].sort(),
    [entries]
  );

  const entities = useMemo(
    () => [...new Set(entries.map((entry) => entry.entidade).filter(Boolean))].sort(),
    [entries]
  );

  const clearFilters = () => {
    setSearch("");
    setSchoolFilter("todos");
    setActionFilter("todos");
    setEntityFilter("todos");
  };

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <FaArrowLeft /> Administração
        </Link>
        <button
          type="button"
          onClick={() => void load({ silent: true })}
          disabled={refreshing}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FaSyncAlt className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <PageTitle
        title="Auditoria da plataforma"
        subtitle="Consulte alterações administrativas registradas no LogView."
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><FaHistory /></div>
            <div><p className="text-sm text-slate-500 dark:text-slate-400">Registros carregados</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? "—" : entries.length}</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><FaBuilding /></div>
            <div><p className="text-sm text-slate-500 dark:text-slate-400">Escolas envolvidas</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? "—" : new Set(entries.map((entry) => entry.escola_id).filter(Boolean)).size}</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><FaUser /></div>
            <div><p className="text-sm text-slate-500 dark:text-slate-400">Registros com usuário</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? "—" : entries.filter((entry) => entry.usuario_id).length}</p></div>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <FaSearch className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por escola, usuário, ação, entidade ou detalhes..."
                className="w-full rounded-xl border border-slate-300 bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500 dark:border-slate-600 dark:text-white"
              />
            </div>
            <div className="relative lg:w-56">
              <FaBuilding className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-8 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                <option value="todos">Todas as escolas</option>
                {schools.map((school) => <option key={school.id} value={school.id}>{school.nome}</option>)}
              </select>
              <FaChevronDown className="pointer-events-none absolute right-3 top-3 text-xs text-slate-400" />
            </div>
            <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white lg:w-40">
              <option value="todos">Todas as ações</option>
              {actions.map((action) => <option key={action} value={action}>{actionLabels[action] || action}</option>)}
            </select>
            <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white lg:w-44">
              <option value="todos">Todas as entidades</option>
              {entities.map((entity) => <option key={entity} value={entity}>{entityLabels[entity] || entity}</option>)}
            </select>
            {(search || schoolFilter !== "todos" || actionFilter !== "todos" || entityFilter !== "todos") && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <FaFilter /> Limpar
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Entidade</th>
                <th className="px-4 py-3">Escola</th>
                <th className="px-4 py-3">Usuário registrado</th>
                <th className="px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-500">Carregando auditoria...</td></tr>
              ) : filteredEntries.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-500">Nenhum registro encontrado.</td></tr>
              ) : (
                filteredEntries.map((entry) => {
                  const expanded = expandedId === entry.id;
                  return (
                    <tr key={entry.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500 dark:text-slate-400">{formatDate(entry.created_at)}</td>
                      <td className="px-4 py-4"><span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">{actionLabels[entry.acao] || entry.acao}</span></td>
                      <td className="px-4 py-4"><p className="font-medium text-slate-800 dark:text-white">{entityLabels[entry.entidade] || entry.entidade}</p><p className="mt-1 max-w-48 truncate text-[11px] text-slate-400" title={entry.entidade_id || ""}>{entry.entidade_id || "Sem ID"}</p></td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-200">{entry.escolas?.nome || "Global / não vinculada"}</td>
                      <td className="px-4 py-4"><p className="font-medium text-slate-700 dark:text-slate-200">{entry.usuarios?.nome || "Não informado"}</p><p className="mt-1 text-xs text-slate-400">{entry.usuarios?.email || "—"}</p></td>
                      <td className="px-4 py-4">
                        <button type="button" onClick={() => setExpandedId(expanded ? null : entry.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                          {expanded ? "Ocultar" : "Ver detalhes"} <FaChevronDown className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
                        </button>
                        {expanded && (
                          <div className="mt-3 min-w-72 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                            {Object.entries(entry.detalhes || {}).length ? Object.entries(entry.detalhes || {}).map(([key, value]) => <DetailRow key={key} label={key} value={value} />) : <p className="text-sm text-slate-500">Sem detalhes adicionais.</p>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>{filteredEntries.length} registro(s) exibido(s) · limite de {PAGE_SIZE}</span>
          <span>{hasMore ? "Existem registros adicionais; a paginação será adicionada conforme o volume crescer." : "Fim dos registros carregados."}</span>
        </div>
      </section>
    </main>
  );
};
