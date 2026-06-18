import { useState, useEffect, useCallback } from "react";
import {
  FaStar,
  FaCheckCircle,
  FaSpinner,
  FaTimes,
  FaSearch,
  FaInbox,
  FaThumbsUp,
  FaThumbsDown,
  FaCircle,
  FaRegStar,
  FaChartBar,
  FaRegComment,
  FaRegEnvelope,
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

const CARGOS = [
  { value: "", label: "Selecionar cargo" },
  { value: "Professor", label: "Professor(a)" },
  { value: "Coordenador", label: "Coordenador(a)" },
  { value: "Diretor", label: "Diretor(a)" },
  { value: "Secretaria", label: "Secretaria" },
  { value: "Gestor", label: "Gestor(a)" },
  { value: "Outro", label: "Outro" },
];

const DIMENSOES = [
  { key: "nota_usabilidade", label: "Facilidade de uso" },
  { key: "nota_desempenho", label: "Velocidade e desempenho" },
  { key: "nota_funcionalidades", label: "Funcionalidades disponíveis" },
];

const TAGS_POSITIVAS = [
  "Interface intuitiva",
  "Rápido e estável",
  "Fácil de aprender",
  "Relatórios úteis",
  "Economiza tempo",
  "Suporte ágil",
];

const TAGS_MELHORIA = [
  "Relatórios",
  "Busca e filtros",
  "Notificações",
  "Velocidade",
  "Acesso mobile",
  "Mais funcionalidades",
];

const NOTA_LABELS = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Regular",
  4: "Bom",
  5: "Excelente",
};

const STAR_COLORS = {
  1: "text-red-500",
  2: "text-orange-400",
  3: "text-amber-400",
  4: "text-lime-500",
  5: "text-green-600",
};

const StarRating = ({ value, onChange, size = 28, readonly = false }) => {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-transform ${readonly ? "cursor-default" : "hover:scale-110 cursor-pointer"}`}
        >
          {star <= active ? (
            <FaStar
              size={size}
              className={`${STAR_COLORS[active] ?? "text-amber-400"} transition-colors`}
            />
          ) : (
            <FaRegStar
              size={size}
              className="text-slate-300 dark:text-slate-600 transition-colors"
            />
          )}
        </button>
      ))}
      {!readonly && value > 0 && (
        <span className="ml-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          {NOTA_LABELS[value]}
        </span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tag toggle button
// ---------------------------------------------------------------------------

const TagButton = ({ label, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
      selected
        ? "border-green-700 bg-green-700 text-white"
        : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-green-600 hover:text-green-700"
    }`}
  >
    {label}
  </button>
);

// ---------------------------------------------------------------------------
// Mini star display (readonly, compact)
// ---------------------------------------------------------------------------

const MiniStars = ({ value }) => (
  <span className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) =>
      s <= value ? (
        <FaStar key={s} size={11} className="text-amber-400" />
      ) : (
        <FaRegStar
          key={s}
          size={11}
          className="text-slate-300 dark:text-slate-600"
        />
      ),
    )}
  </span>
);

// ---------------------------------------------------------------------------
// Feedback detail modal (admin)
// ---------------------------------------------------------------------------

const FeedbackModal = ({ feedback, onClose, onUpdate }) => {
  const [resposta, setResposta] = useState(feedback.resposta_admin || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("feedbacks")
      .update({ resposta_admin: resposta || null, lido_admin: true })
      .eq("id", feedback.id);
    setSaving(false);

    if (error) {
      notify.error("Erro ao salvar resposta.");
      return;
    }
    notify.success("Resposta salva!");
    onUpdate({ ...feedback, resposta_admin: resposta, lido_admin: true });
    onClose();
  };

  const handleMarkRead = async () => {
    const { error } = await supabase
      .from("feedbacks")
      .update({ lido_admin: true })
      .eq("id", feedback.id);
    if (!error) onUpdate({ ...feedback, lido_admin: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <MiniStars value={feedback.avaliacao} />
              <span className="text-xs text-slate-400">
                {feedback.avaliacao}/5 — {NOTA_LABELS[feedback.avaliacao]}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white leading-snug">
              {feedback.titulo || "Sem título"}
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
          {/* Author */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400">Nome</span>
              <span className="font-semibold text-slate-800 dark:text-white">
                {feedback.nome}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400">Cargo</span>
              <span className="font-semibold text-slate-800 dark:text-white">
                {feedback.cargo || "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400">E-mail</span>
              <span className="font-semibold text-slate-800 dark:text-white break-all">
                {feedback.email}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400">Recomendaria?</span>
              <span
                className={`font-semibold ${feedback.recomendaria ? "text-green-700" : "text-red-500"}`}
              >
                {feedback.recomendaria === null
                  ? "—"
                  : feedback.recomendaria
                    ? "Sim"
                    : "Não"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400">Enviado em</span>
              <span className="font-semibold text-slate-800 dark:text-white">
                {new Date(feedback.criado_em).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>

          {/* Dimensões */}
          {(feedback.nota_usabilidade ||
            feedback.nota_desempenho ||
            feedback.nota_funcionalidades) && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Notas por dimensão
              </span>
              <div className="flex flex-col gap-2">
                {DIMENSOES.map(({ key, label }) =>
                  feedback[key] ? (
                    <div
                      key={key}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-600 dark:text-slate-400">
                        {label}
                      </span>
                      <div className="flex items-center gap-2">
                        <MiniStars value={feedback[key]} />
                        <span className="text-xs text-slate-400">
                          {feedback[key]}/5
                        </span>
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {(feedback.pontos_positivos?.length > 0 ||
            feedback.pontos_melhoria?.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {feedback.pontos_positivos?.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Pontos positivos
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {feedback.pontos_positivos.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {feedback.pontos_melhoria?.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    A melhorar
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {feedback.pontos_melhoria.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comentário */}
          {feedback.comentario && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Comentário
              </span>
              <p className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {feedback.comentario}
              </p>
            </div>
          )}

          {/* Resposta admin */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Resposta interna (opcional)
            </span>
            <textarea
              rows={3}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="Adicione uma anotação ou resposta interna..."
              className="resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
          {!feedback.lido_admin && (
            <button
              type="button"
              onClick={handleMarkRead}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors underline underline-offset-2"
            >
              Marcar como lido
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <FaSpinner className="animate-spin" size={12} />
                  Salvando...
                </span>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Admin feedback panel
// ---------------------------------------------------------------------------

const AdminFeedbacks = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroNota, setFiltroNota] = useState("");
  const [filtroLido, setFiltroLido] = useState("");
  const [selected, setSelected] = useState(null);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feedbacks")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      notify.error("Erro ao carregar feedbacks.");
    } else {
      setFeedbacks(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleUpdate = (updated) => {
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === updated.id ? updated : f)),
    );
  };

  const filtered = feedbacks.filter((f) => {
    const matchBusca =
      !busca ||
      f.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      f.email?.toLowerCase().includes(busca.toLowerCase()) ||
      f.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
      f.comentario?.toLowerCase().includes(busca.toLowerCase());
    const matchNota = !filtroNota || String(f.avaliacao) === filtroNota;
    const matchLido =
      filtroLido === "" ||
      (filtroLido === "nao_lido" && !f.lido_admin) ||
      (filtroLido === "lido" && f.lido_admin);
    return matchBusca && matchNota && matchLido;
  });

  // Stats
  const mediaGeral =
    feedbacks.length > 0
      ? (
          feedbacks.reduce((a, f) => a + f.avaliacao, 0) / feedbacks.length
        ).toFixed(1)
      : "—";
  const naoLidos = feedbacks.filter((f) => !f.lido_admin).length;
  const recomendamPct =
    feedbacks.length > 0
      ? Math.round(
          (feedbacks.filter((f) => f.recomendaria === true).length /
            feedbacks.length) *
            100,
        )
      : "—";

  const NOTA_FILTER_OPTIONS = [
    { value: "", label: "Todas as notas" },
    { value: "5", label: "⭐⭐⭐⭐⭐ Excelente" },
    { value: "4", label: "⭐⭐⭐⭐ Bom" },
    { value: "3", label: "⭐⭐⭐ Regular" },
    { value: "2", label: "⭐⭐ Ruim" },
    { value: "1", label: "⭐ Muito ruim" },
  ];

  const LIDO_OPTIONS = [
    { value: "", label: "Todos" },
    { value: "nao_lido", label: "Não lidos" },
    { value: "lido", label: "Lidos" },
  ];

  return (
    <>
      {selected && (
        <FeedbackModal
          feedback={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}

      <div className="flex flex-col gap-5">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: "Total de feedbacks",
              value: feedbacks.length,
              icon: FaRegComment,
            },
            { label: "Nota média", value: mediaGeral, icon: FaStar },
            { label: "Não lidos", value: naoLidos, icon: FaRegEnvelope },
            {
              label: "Recomendam",
              value: recomendamPct === "—" ? "—" : `${recomendamPct}%`,
              icon: FaThumbsUp,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3"
            >
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Icon size={11} />
                {label}
              </div>
              <span className="text-2xl font-bold text-slate-800 dark:text-white">
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Distribution bar */}
        {feedbacks.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Distribuição de notas
            </span>
            <div className="flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((nota) => {
                const count = feedbacks.filter(
                  (f) => f.avaliacao === nota,
                ).length;
                const pct =
                  feedbacks.length > 0 ? (count / feedbacks.length) * 100 : 0;
                return (
                  <div key={nota} className="flex items-center gap-3 text-xs">
                    <span className="w-16 text-slate-500 flex items-center gap-1">
                      {nota} <FaStar size={9} className="text-amber-400" />
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-slate-400">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <FaSearch
              size={12}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail, título ou comentário..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            />
          </div>
          <div className="sm:w-48">
            <CustomSelect
              value={filtroNota}
              onChange={setFiltroNota}
              options={NOTA_FILTER_OPTIONS}
            />
          </div>
          <div className="sm:w-36">
            <CustomSelect
              value={filtroLido}
              onChange={setFiltroLido}
              options={LIDO_OPTIONS}
            />
          </div>
          {(busca || filtroNota || filtroLido) && (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setFiltroNota("");
                setFiltroLido("");
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <FaTimes size={10} /> Limpar
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <FaSpinner className="animate-spin" size={16} /> Carregando
              feedbacks...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-400">
              <FaInbox size={28} />
              <p className="text-sm font-medium">Nenhum feedback encontrado.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  {[
                    "",
                    "Nome / Cargo",
                    "Nota",
                    "Título",
                    "Recomenda",
                    "Data",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((f) => (
                  <tr
                    key={f.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                  >
                    {/* Lido indicator */}
                    <td className="px-3 py-3">
                      {!f.lido_admin && (
                        <span
                          className="block w-2 h-2 rounded-full bg-green-600"
                          title="Não lido"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 dark:text-white leading-tight">
                        {f.nome}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {f.cargo || f.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <MiniStars value={f.avaliacao} />
                        <span className="text-xs text-slate-400">
                          {f.avaliacao}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate text-slate-700 dark:text-slate-300">
                        {f.titulo || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {f.recomendaria === null ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : f.recomendaria ? (
                        <span className="flex items-center gap-1 text-green-700 text-xs font-semibold">
                          <FaThumbsUp size={11} /> Sim
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 text-xs font-semibold">
                          <FaThumbsDown size={11} /> Não
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">
                      {new Date(f.criado_em).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(f)}
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
            {filtered.length} feedback{filtered.length !== 1 ? "s" : ""} exibido
            {filtered.length !== 1 ? "s" : ""}
            {feedbacks.length !== filtered.length &&
              ` de ${feedbacks.length} no total`}
          </p>
        )}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Feedback form
// ---------------------------------------------------------------------------

const FeedbackForm = ({ user, onSent }) => {
  const [nome, setNome] = useState(user?.nome || "");
  const [email, setEmail] = useState(user?.email || "");
  const [cargo, setCargo] = useState("");
  const [avaliacao, setAvaliacao] = useState(0);
  const [dimensoes, setDimensoes] = useState({
    nota_usabilidade: 0,
    nota_desempenho: 0,
    nota_funcionalidades: 0,
  });
  const [titulo, setTitulo] = useState("");
  const [comentario, setComentario] = useState("");
  const [positivos, setPositivos] = useState([]);
  const [melhoria, setMelhoria] = useState([]);
  const [recomendaria, setRecomendaria] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (list, setList, tag) => {
    setList((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nome || !email || avaliacao === 0) {
      notify.warning("Preencha seu nome, e-mail e a avaliação geral.");
      return;
    }

    setSubmitting(true);

    const payload = {
      usuario_id: user?.id || null,
      escola_id: user?.escola_id || null,
      nome,
      email,
      cargo: cargo || null,
      avaliacao,
      nota_usabilidade: dimensoes.nota_usabilidade || null,
      nota_desempenho: dimensoes.nota_desempenho || null,
      nota_funcionalidades: dimensoes.nota_funcionalidades || null,
      titulo: titulo || null,
      comentario: comentario || null,
      pontos_positivos: positivos.length > 0 ? positivos : null,
      pontos_melhoria: melhoria.length > 0 ? melhoria : null,
      recomendaria: recomendaria,
    };

    const { data, error } = await supabase
      .from("feedbacks")
      .insert(payload)
      .select();


    if (error) {
      notify.error(error.message);
      return;
    }
    setSubmitting(false);

    if (error) {
      notify.error("Erro ao enviar feedback. Tente novamente.");
      return;
    }

    notify.success("Feedback enviado! Obrigado pela avaliação.");
    onSent();
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      {/* Identificação */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Identificação
        </span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              label="Cargo"
              value={cargo}
              onChange={setCargo}
              options={CARGOS}
              placeholder="Selecionar cargo"
            />
          </div>
        </div>
      </div>

      {/* Avaliação geral */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Como você avalia o sistema no geral?
        </span>
        <StarRating value={avaliacao} onChange={setAvaliacao} size={32} />
      </div>

      {/* Dimensões */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Avalie cada aspecto (opcional)
        </span>
        <div className="flex flex-col gap-3">
          {DIMENSOES.map(({ key, label }) => (
            <div
              key={key}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {label}
              </span>
              <StarRating
                value={dimensoes[key]}
                onChange={(val) =>
                  setDimensoes((prev) => ({ ...prev, [key]: val }))
                }
                size={20}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pontos positivos */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          O que você mais gosta? (opcional)
        </span>
        <div className="flex flex-wrap gap-2">
          {TAGS_POSITIVAS.map((tag) => (
            <TagButton
              key={tag}
              label={tag}
              selected={positivos.includes(tag)}
              onClick={() => toggleTag(positivos, setPositivos, tag)}
            />
          ))}
        </div>
      </div>

      {/* Pontos de melhoria */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          O que pode melhorar? (opcional)
        </span>
        <div className="flex flex-wrap gap-2">
          {TAGS_MELHORIA.map((tag) => (
            <TagButton
              key={tag}
              label={tag}
              selected={melhoria.includes(tag)}
              onClick={() => toggleTag(melhoria, setMelhoria, tag)}
            />
          ))}
        </div>
      </div>

      {/* Título e comentário */}
      <div className="flex flex-col gap-4">
        <FormInput
          label="Título do feedback (opcional)"
          type="text"
          placeholder="Ex: Ótima ferramenta para o dia a dia"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-400">
            Comentário (opcional)
          </label>
          <textarea
            rows={4}
            placeholder="Conte com detalhes o que achou do sistema..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
      </div>

      {/* Recomendaria */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Você recomendaria este sistema a um colega?
        </span>
        <div className="flex gap-3">
          {[
            {
              val: true,
              label: "Sim",
              icon: FaThumbsUp,
              active: "border-green-700 bg-green-700 text-white",
            },
            {
              val: false,
              label: "Não",
              icon: FaThumbsDown,
              active: "border-red-500 bg-red-500 text-white",
            },
          ].map(({ val, label, icon: Icon, active }) => (
            <button
              key={String(val)}
              type="button"
              onClick={() =>
                setRecomendaria((prev) => (prev === val ? null : val))
              }
              className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                recomendaria === val
                  ? active
                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-400"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
        <Button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <FaSpinner className="animate-spin" size={12} /> Enviando...
            </span>
          ) : (
            "Enviar avaliação"
          )}
        </Button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const Feedback = () => {
  const { user } = useAuth();
  const isAdmin = Number(user?.role_id) === 1;
  const [enviado, setEnviado] = useState(false);

  return (
    <div className="flex w-full flex-col gap-10">
      {/* Header */}
      <PageTitle
        title="Avaliação do sistema"
        subtitle={
          <>
            Sua opinião nos ajuda a melhorar.{" "}
            <span className="font-semibold text-green-700">
              Leva menos de 2 minutos.
            </span>
          </>
        }
      />

      {/* ---------------------------------------------------------------- */}
      {/* Admin: feedback panel */}
      {/* ---------------------------------------------------------------- */}
      {isAdmin && (
        <div className="flex flex-col gap-3">
          <SectionTitle text="Feedbacks recebidos" />

          <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
            <div className="mb-5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center text-green-700 flex-shrink-0">
                <FaChartBar size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">
                  Painel de avaliações
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Visualize, filtre e responda aos feedbacks enviados pelos
                  usuários.
                </p>
              </div>
            </div>

            <AdminFeedbacks />
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Feedback form */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <SectionTitle text="Enviar avaliação" />

        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-600 dark:bg-slate-950">
          {enviado ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <FaCheckCircle size={32} className="text-green-700" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800 dark:text-white">
                  Obrigado pelo feedback!
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Sua avaliação foi registrada e nos ajudará a melhorar o
                  sistema.
                </p>
              </div>
              <Button variant="outline" onClick={() => setEnviado(false)}>
                Enviar outra avaliação
              </Button>
            </div>
          ) : (
            <FeedbackForm user={user} onSent={() => setEnviado(true)} />
          )}
        </div>
      </div>
    </div>
  );
};
