import { useCallback, useEffect, useMemo, useState } from "react";
import { FaCheck, FaEye, FaEyeSlash, FaSearch, FaStar, FaSpinner } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { notify } from "../utils/notify";
import { supabase } from "../utils/supabase";

const StarDisplay = ({ value }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5 estrelas`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <FaStar key={star} size={12} className={star <= value ? "text-amber-400" : "text-slate-300 dark:text-slate-700"} />
    ))}
  </span>
);

export const AdminFeedbacks = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("feedbacks").select("*").order("criado_em", { ascending: false });
    if (error) notify.error("Não foi possível carregar os feedbacks.");
    else setFeedbacks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadFeedbacks(); }, [loadFeedbacks]);

  const filtered = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return feedbacks;
    return feedbacks.filter((f) => [f.nome, f.email, f.cargo, f.titulo, f.comentario].some((value) => value?.toLowerCase().includes(term)));
  }, [feedbacks, busca]);

  const togglePublicacao = async (feedback) => {
    if (!feedback.autoriza_publicacao && !feedback.publicado) {
      notify.warning("Este feedback não autorizou a publicação.");
      return;
    }
    setSaving(true);
    const publicado = !feedback.publicado;
    const { error } = await supabase.from("feedbacks").update({ publicado }).eq("id", feedback.id);
    setSaving(false);
    if (error) {
      notify.error("Não foi possível atualizar a publicação.");
      return;
    }
    const updated = { ...feedback, publicado };
    setFeedbacks((prev) => prev.map((item) => item.id === feedback.id ? updated : item));
    setSelected((current) => current?.id === feedback.id ? updated : current);
    notify.success(publicado ? "Feedback publicado na landing." : "Feedback retirado da landing.");
  };

  return (
    <div className="flex w-full flex-col gap-6 text-slate-900 dark:text-white">
      <PageTitle title="Feedbacks da landing" subtitle="Leia as avaliações recebidas e escolha quais podem aparecer na página inicial." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar feedback..." className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" />
        </div>
        <span className="text-xs text-slate-400">{feedbacks.length} recebido{feedbacks.length === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-950"><FaSpinner className="animate-spin" /> Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-950">Nenhum feedback encontrado.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((feedback) => (
            <article key={feedback.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><StarDisplay value={feedback.avaliacao} /><span className="text-xs text-slate-400">{feedback.avaliacao}/5</span></div>
                  <h2 className="mt-2 truncate font-bold">{feedback.titulo || "Sem título"}</h2>
                  <p className="mt-1 text-xs text-slate-400">{feedback.nome}{feedback.cargo ? ` · ${feedback.cargo}` : ""}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${feedback.publicado ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>{feedback.publicado ? "Na landing" : "Não publicado"}</span>
              </div>
              {feedback.comentario && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">“{feedback.comentario}”</p>}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button type="button" onClick={() => setSelected(feedback)} className="text-xs font-semibold text-slate-500 hover:text-green-700">Ver detalhes</button>
                <button type="button" disabled={saving || (!feedback.autoriza_publicacao && !feedback.publicado)} onClick={() => togglePublicacao(feedback)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${feedback.publicado ? "border border-red-200 text-red-600 hover:bg-red-50" : "bg-green-700 text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"}`}>
                  {feedback.publicado ? <FaEyeSlash /> : <FaEye />}
                  {feedback.publicado ? "Retirar da landing" : "Mostrar na landing"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center overflow-y-auto bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-slate-950">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div><h3 className="font-bold">{selected.titulo || "Feedback"}</h3><p className="mt-1 text-xs text-slate-400">{selected.nome} · {selected.email}</p></div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">×</button>
            </div>
            <div className="flex flex-col gap-5 p-5 text-sm">
              <StarDisplay value={selected.avaliacao} />
              <p className="whitespace-pre-wrap leading-6 text-slate-700 dark:text-slate-300">{selected.comentario || "Sem comentário."}</p>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <p>Autorizou publicação: <strong>{selected.autoriza_publicacao ? "Sim" : "Não"}</strong></p>
                <p className="mt-1">Recomendaria: <strong>{selected.recomendaria == null ? "Não informado" : selected.recomendaria ? "Sim" : "Não"}</strong></p>
                <p className="mt-1">Enviado em: <strong>{new Date(selected.criado_em).toLocaleString("pt-BR")}</strong></p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold dark:border-slate-700">Fechar</button>
                <button type="button" disabled={saving || (!selected.autoriza_publicacao && !selected.publicado)} onClick={() => togglePublicacao(selected)} className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><FaCheck /> {selected.publicado ? "Retirar publicação" : "Publicar na landing"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
