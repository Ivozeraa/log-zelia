import { useState, useEffect, useCallback } from "react";
import {
  FaHeadset,
  FaQuestionCircle,
  FaEnvelope,
  FaWhatsapp,
  FaClock,
  FaCheckCircle,
  FaInbox,
  FaSearch,
  FaFilter,
  FaChevronDown,
  FaTimes,
  FaSpinner,
  FaCircle,
} from "react-icons/fa";

import { PageTitle } from "../components/ui/PageTitle";
import { SectionTitle } from "../components/ui/SectionTitle";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { FormInput } from "../components/ui/FormInput";
import { CustomSelect } from "../components/ui/CustomSelect";
import { notify } from "../utils/notify";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../utils/supabase";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    pergunta: "Como registrar uma ocorrência?",
    resposta:
      'Acesse a página Início e clique em "Adicionar Advertência". Selecione a escola, turma, aluno(s) e preencha os dados da ocorrência.',
  },
  {
    pergunta: "Como suspender um aluno?",
    resposta:
      'Na tela de registro, selecione "Suspensão" em Tipo de advertência. Informe as datas de início e término. O sistema atualiza o status automaticamente.',
  },
  {
    pergunta: "Posso registrar para vários alunos ao mesmo tempo?",
    resposta:
      'Sim! No campo "Aluno(s)" é possível selecionar múltiplos alunos. A mesma ocorrência será registrada para todos.',
  },
  {
    pergunta: "Quem pode ver o painel de gestão?",
    resposta:
      "A aba Gestão é visível apenas para usuários com perfil de gestor, coordenador ou administrador.",
  },
  {
    pergunta: "Como redefinir minha senha?",
    resposta:
      'Acesse a página de login e clique em "Esqueci minha senha". Um link de redefinição será enviado para o e-mail cadastrado.',
  },
];

const CATEGORIAS = [
  { value: "", label: "Selecionar categoria" },
  { value: "acesso", label: "Acesso e login" },
  { value: "ocorrencia", label: "Registrar ocorrência" },
  { value: "relatorios", label: "Relatórios" },
  { value: "alunos", label: "Gestão de alunos" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "resolvido", label: "Resolvido" },
  { value: "fechado", label: "Fechado" },
];

const STATUS_CONFIG = {
  aberto: {
    label: "Aberto",
    color: "text-amber-600",
    bg: "bg-amber-100",
    dot: "bg-amber-500",
  },
  em_andamento: {
    label: "Em andamento",
    color: "text-blue-600",
    bg: "bg-blue-100",
    dot: "bg-blue-500",
  },
  resolvido: {
    label: "Resolvido",
    color: "text-green-700",
    bg: "bg-green-100",
    dot: "bg-green-600",
  },
  fechado: {
    label: "Fechado",
    color: "text-slate-500",
    bg: "bg-slate-100",
    dot: "bg-slate-400",
  },
};

const CATEGORIA_LABELS = {
  acesso: "Acesso e login",
  ocorrencia: "Registrar ocorrência",
  relatorios: "Relatórios",
  alunos: "Gestão de alunos",
  outro: "Outro",
};

// ---------------------------------------------------------------------------
// Small reusable sub-components
// ---------------------------------------------------------------------------

const FaqItem = ({ pergunta, resposta }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
      >
        {pergunta}
        <span
          className={`text-green-700 text-lg transition-transform duration-200 ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-slate-700">
          {resposta}
        </div>
      )}
    </div>
  );
};

const ContactItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl">
    <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center text-green-700 shrink-0">
      <Icon size={16} />
    </div>
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-800 dark:text-white">
        {value}
      </span>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.aberto;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}
    >
      <FaCircle size={6} className={cfg.dot} />
      {cfg.label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Ticket detail modal
// ---------------------------------------------------------------------------

const TicketModal = ({ ticket, onClose, onStatusChange }) => {
  const [novoStatus, setNovoStatus] = useState(ticket.status);
  const [resposta, setResposta] = useState(ticket.resposta_admin || "");
  const [saving, setSaving] = useState(false);

  const STATUS_EDIT_OPTIONS = [
    { value: "aberto", label: "Aberto" },
    { value: "em_andamento", label: "Em andamento" },
    { value: "resolvido", label: "Resolvido" },
    { value: "fechado", label: "Fechado" },
  ];

  const handleSave = async () => {
    setSaving(true);

    const updates = {
      status: novoStatus,
      resposta_admin: resposta || null,
    };

    if (novoStatus === "resolvido" && ticket.status !== "resolvido") {
      updates.resolvido_em = new Date().toISOString();
    }

    const { error, data } = await supabase
      .from("chamados")
      .update(updates)
      .eq("id", ticket.id);

    console.log("UPDATES:", updates);
    console.log("DATA:", data);
    console.error("ERROR:", error);

    setSaving(false);

    if (error) {
      notify.error("Erro ao salvar alterações.");
      return;
    }

    notify.success("Chamado atualizado com sucesso!");
    onStatusChange({ ...ticket, ...updates });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Chamado #{ticket.id?.slice(0, 8)}
            </p>
            <h3 className="text-base font-bold text-slate-800 dark:text-white leading-snug">
              {ticket.assunto}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 py-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400">Nome</span>
              <span className="font-semibold text-slate-800 dark:text-white">
                {ticket.nome}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400">E-mail</span>
              <span className="font-semibold text-slate-800 dark:text-white break-all">
                {ticket.email}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400">Categoria</span>
              <span className="font-semibold text-slate-800 dark:text-white">
                {CATEGORIA_LABELS[ticket.categoria] ?? ticket.categoria}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400">Abertura</span>
              <span className="font-semibold text-slate-800 dark:text-white">
                {ticket.criado_em
                  ? new Date(ticket.criado_em).toLocaleDateString("pt-BR")
                  : "—"}
              </span>
            </div>
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Descrição
            </span>
            <p className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {ticket.descricao}
            </p>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Status
            </span>
            <div className="flex gap-2 flex-wrap">
              {STATUS_EDIT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNovoStatus(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                    novoStatus === opt.value
                      ? "border-green-700 bg-green-700 text-white"
                      : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-green-600 hover:text-green-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resposta */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Resposta ao usuário
            </span>
            <textarea
              rows={3}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="Escreva uma resposta para o usuário (opcional)..."
              className="resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-2">
                <FaSpinner className="animate-spin" size={12} /> Salvando...
              </span>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Admin ticket management panel
// ---------------------------------------------------------------------------

const AdminChamados = () => {
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchChamados = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("chamados")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      notify.error("Erro ao carregar chamados.");
    } else {
      setChamados(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChamados();
  }, [fetchChamados]);

  const handleStatusChange = (updated) => {
    setChamados((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const filtered = chamados.filter((c) => {
    const matchBusca =
      !busca ||
      c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.email?.toLowerCase().includes(busca.toLowerCase()) ||
      c.assunto?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = !filtroStatus || c.status === filtroStatus;
    const matchCategoria = !filtroCategoria || c.categoria === filtroCategoria;
    return matchBusca && matchStatus && matchCategoria;
  });

  const statusCounts = chamados.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const CATEGORIA_FILTER_OPTIONS = [
    { value: "", label: "Todas as categorias" },
    ...CATEGORIAS.filter((c) => c.value !== ""),
  ];

  return (
    <>
      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      <div className="flex flex-col gap-4">
        {/* Summary pills */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setFiltroStatus((prev) => (prev === key ? "" : key))
              }
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                filtroStatus === key
                  ? `${cfg.bg} ${cfg.color} border-transparent`
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
              <span className="rounded-full bg-white/60 dark:bg-slate-800 px-1.5 py-px text-[10px] font-bold">
                {statusCounts[key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/* Search */}
          <div className="relative flex-1">
            <FaSearch
              size={12}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou assunto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            />
          </div>

          {/* Categoria filter */}
          <div className="sm:w-52 relative">
            <CustomSelect
              value={filtroCategoria}
              onChange={setFiltroCategoria}
              options={CATEGORIA_FILTER_OPTIONS}
              placeholder="Todas as categorias"
            />
          </div>

          {(busca || filtroStatus || filtroCategoria) && (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setFiltroStatus("");
                setFiltroCategoria("");
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <FaTimes size={10} /> Limpar filtros
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <FaSpinner className="animate-spin" size={16} />
              Carregando chamados...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-400">
              <FaInbox size={28} />
              <p className="text-sm font-medium">Nenhum chamado encontrado.</p>
              {(busca || filtroStatus || filtroCategoria) && (
                <p className="text-xs">Tente ajustar os filtros acima.</p>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  {[
                    "Nome / E-mail",
                    "Assunto",
                    "Categoria",
                    "Status",
                    "Abertura",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 dark:text-white leading-tight">
                        {c.nome}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 max-w-50">
                      <p className="truncate text-slate-700 dark:text-slate-300">
                        {c.assunto}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {CATEGORIA_LABELS[c.categoria] ?? c.categoria}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {c.criado_em
                        ? new Date(c.criado_em).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(c)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:border-green-600 hover:text-green-700 transition-colors whitespace-nowrap"
                      >
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-slate-400 text-right">
            {filtered.length} chamado{filtered.length !== 1 ? "s" : ""} exibido
            {filtered.length !== 1 ? "s" : ""}
            {chamados.length !== filtered.length &&
              ` de ${chamados.length} no total`}
          </p>
        )}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const Suporte = () => {
  const { user } = useAuth();
  const isAdmin = Number(user?.role_id) === 1;

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [categoria, setCategoria] = useState("");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [stats, setStats] = useState({
    abertos: 0,
    resolvidosMes: 0,
    tempoMedio: "—",
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.id) return;
      setLoadingStats(true);

      const filtro =
        Number(user.role_id) === 1 ? {} : { escola_id: user.escola_id };
      let query = supabase
        .from("chamados")
        .select("id, status, criado_em, resolvido_em");
      if (filtro.escola_id) query = query.eq("escola_id", filtro.escola_id);

      const { data, error } = await query;
      if (error) {
        setLoadingStats(false);
        return;
      }

      const abertos = data.filter((c) => c.status === "aberto").length;

      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const resolvidosMes = data.filter(
        (c) =>
          c.status === "resolvido" &&
          c.resolvido_em &&
          new Date(c.resolvido_em) >= inicioMes,
      ).length;

      const resolvidos = data.filter(
        (c) => c.status === "resolvido" && c.criado_em && c.resolvido_em,
      );

      let tempoMedio = "—";
      if (resolvidos.length > 0) {
        const mediaMs =
          resolvidos.reduce((acc, c) => {
            return (
              acc +
              (new Date(c.resolvido_em).getTime() -
                new Date(c.criado_em).getTime())
            );
          }, 0) / resolvidos.length;
        const horas = Math.round(mediaMs / (1000 * 60 * 60));
        tempoMedio = horas < 24 ? `${horas}h` : `${Math.round(horas / 24)}d`;
      }

      setStats({ abertos, resolvidosMes, tempoMedio });
      setLoadingStats(false);
    };

    loadStats();
  }, [user]);

  const resetForm = () => {
    setNome("");
    setEmail(user?.email || "");
    setCategoria("");
    setAssunto("");
    setDescricao("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!nome || !email || !categoria || !assunto || !descricao) {
      notify.warning("Preencha todos os campos antes de enviar.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("chamados").insert({
      usuario_id: user?.id,
      escola_id: user?.escola_id || null,
      nome,
      email,
      categoria,
      assunto,
      descricao,
      status: "aberto",
    });
    setSubmitting(false);

    if (error) {
      notify.error("Erro ao enviar dúvida. Tente novamente.");
      return;
    }

    setEnviado(true);
    notify.success("Dúvida enviada com sucesso!");
    setStats((prev) => ({ ...prev, abertos: prev.abertos + 1 }));
  };

  return (
    <div className="flex w-full flex-col gap-10">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
        <PageTitle
          title="Suporte"
          subtitle={
            <>
              Ficou com alguma dúvida?{" "}
              <span className="font-semibold text-green-700">
                Nossa equipe responde em até 24h.
              </span>
            </>
          }
        />
        <div className="flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-xs font-semibold text-green-700">
          <FaClock size={12} />
          <span>Seg – Sex, 8h às 18h</span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Overview cards */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <SectionTitle text="Visão Geral" />
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card
            title="Chamados abertos"
            content={loadingStats ? "..." : stats.abertos}
          />
          <Card
            title="Resolvidos este mês"
            content={loadingStats ? "..." : stats.resolvidosMes}
          />
          <Card
            title="Tempo médio de resposta"
            content={loadingStats ? "..." : stats.tempoMedio}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Admin: ticket management */}
      {/* ------------------------------------------------------------------ */}
      {isAdmin && (
        <div className="flex flex-col gap-3">
          <SectionTitle text="Gerenciar Chamados" />

          <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
            <div className="mb-5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center text-green-700 shrink-0">
                <FaInbox size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">
                  Todos os chamados
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Visualize, filtre e atualize o status de cada chamado.
                </p>
              </div>
            </div>

            <AdminChamados />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Send ticket + FAQ + Contact */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Send form */}
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
          <div className="mb-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center text-green-700 shrink-0">
              <FaHeadset size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">
                Enviar dúvida
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Descreva seu problema e entraremos em contato.
              </p>
            </div>
          </div>

          {enviado ? (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <FaCheckCircle size={28} className="text-green-700" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-800 dark:text-white">
                  Dúvida enviada com sucesso!
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Nossa equipe responderá em breve no seu e-mail.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setEnviado(false);
                }}
              >
                Enviar nova dúvida
              </Button>
            </div>
          ) : (
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              onSubmit={handleSubmit}
            >
              <FormInput
                label="Seu nome"
                type="text"
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <FormInput
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="sm:col-span-2">
                <CustomSelect
                  label="Categoria"
                  value={categoria}
                  onChange={(val) => setCategoria(val)}
                  options={CATEGORIAS}
                  placeholder="Selecionar categoria"
                />
              </div>
              <div className="sm:col-span-2">
                <FormInput
                  label="Assunto"
                  type="text"
                  placeholder="Resumo do problema"
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-400">
                  Descrição
                </label>
                <textarea
                  placeholder="Descreva sua dúvida com detalhes..."
                  rows={5}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="h-36 resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={resetForm}
                >
                  Limpar
                </Button>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={submitting}
                >
                  {submitting ? "Enviando..." : "Enviar dúvida"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* FAQ + Contact */}
        <div className="flex flex-col gap-6">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
            <div className="mb-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center text-green-700 shrink-0">
                <FaQuestionCircle size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">
                  Perguntas frequentes
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Respostas para as dúvidas mais comuns.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.pergunta} {...item} />
              ))}
            </div>
          </div>

          <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
            <div className="mb-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center text-green-700 shrink-0">
                <FaHeadset size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">
                  Outros canais
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Fale conosco por outros meios.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <ContactItem
                icon={FaEnvelope}
                label="E-mail"
                value="logzelia@gmail.com"
              />
              <ContactItem
                icon={FaWhatsapp}
                label="WhatsApp"
                value="(85) 9 9819-9334"
              />
              <ContactItem
                icon={FaClock}
                label="Horário de atendimento"
                value="Seg – Sex, 8h às 18h"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
