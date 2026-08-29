import { useCallback, useEffect, useMemo, useState } from "react";
import { FaCheck, FaEye, FaEyeSlash, FaSearch, FaStar, FaSpinner, FaBullhorn, FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { notify } from "../utils/notify";
import { supabase } from "../utils/supabase";

const StarDisplay = ({ value }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5 estrelas`}>
    {[1, 2, 3, 4, 5].map((star) => <FaStar key={star} size={12} className={star <= value ? "text-amber-400" : "text-slate-300 dark:text-slate-700"} />)}
  </span>
);

const TIPO_AVISO = [
  { value: "aviso", label: "Aviso" },
  { value: "novidade", label: "Novidade" },
  { value: "atualizacao", label: "Atualização" },
];

const AVISO_VAZIO = { titulo: "", conteudo: "", tipo: "aviso", publicado: true };

export const AdminFeedbacks = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("feedbacks");
  const [avisoModal, setAvisoModal] = useState(false);
  const [selectedAviso, setSelectedAviso] = useState(null);
  const [avisoForm, setAvisoForm] = useState(AVISO_VAZIO);
  const [savingAviso, setSavingAviso] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: feedbackData, error: feedbackError }, { data: avisoData, error: avisoError }] = await Promise.all([
      supabase.from("feedbacks").select("*").order("criado_em", { ascending: false }),
      supabase.from("avisos").select("*").order("criado_em", { ascending: false }),
    ]);
    if (feedbackError) notify.error("Não foi possível carregar os feedbacks.");
    if (avisoError) notify.error("Não foi possível carregar os avisos.");
    setFeedbacks(feedbackData || []);
    setAvisos(avisoData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return feedbacks;
    return feedbacks.filter((f) => [f.nome, f.email, f.cargo, f.titulo, f.comentario].some((value) => value?.toLowerCase().includes(term)));
  }, [feedbacks, busca]);

  const filteredAvisos = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return avisos;
    return avisos.filter((a) => [a.titulo, a.conteudo, a.tipo].some((value) => value?.toLowerCase().includes(term)));
  }, [avisos, busca]);

  const togglePublicacao = async (feedback) => {
    if (!feedback.autoriza_publicacao && !feedback.publicado) { notify.warning("Este feedback não autorizou a publicação."); return; }
    setSaving(true);
    const publicado = !feedback.publicado;
    const { error } = await supabase.from("feedbacks").update({ publicado }).eq("id", feedback.id);
    setSaving(false);
    if (error) { notify.error("Não foi possível atualizar a publicação."); return; }
    const updated = { ...feedback, publicado };
    setFeedbacks((prev) => prev.map((item) => item.id === feedback.id ? updated : item));
    setSelected((current) => current?.id === feedback.id ? updated : current);
    notify.success(publicado ? "Feedback publicado na landing." : "Feedback retirado da landing.");
  };

  const openNovoAviso = () => { setSelectedAviso(null); setAvisoForm(AVISO_VAZIO); setAvisoModal(true); };
  const openEditarAviso = (aviso) => { setSelectedAviso(aviso); setAvisoForm({ titulo: aviso.titulo || "", conteudo: aviso.conteudo || "", tipo: aviso.tipo || "aviso", publicado: aviso.publicado !== false }); setAvisoModal(true); };

  const salvarAviso = async () => {
    if (!avisoForm.titulo.trim() || !avisoForm.conteudo.trim()) { notify.warning("Preencha o título e o conteúdo do aviso."); return; }
    setSavingAviso(true);
    const payload = { titulo: avisoForm.titulo.trim(), conteudo: avisoForm.conteudo.trim(), tipo: avisoForm.tipo, publicado: avisoForm.publicado, atualizado_em: new Date().toISOString() };
    const result = selectedAviso
      ? await supabase.from("avisos").update(payload).eq("id", selectedAviso.id).select().single()
      : await supabase.from("avisos").insert(payload).select().single();
    setSavingAviso(false);
    if (result.error) { notify.error("Não foi possível salvar o aviso."); return; }
    setAvisos((prev) => selectedAviso ? prev.map((item) => item.id === selectedAviso.id ? result.data : item) : [result.data, ...prev]);
    setAvisoModal(false);
    notify.success(selectedAviso ? "Aviso atualizado." : "Aviso criado.");
  };

  const toggleAviso = async (aviso) => {
    const publicado = !aviso.publicado;
    const { data, error } = await supabase.from("avisos").update({ publicado, atualizado_em: new Date().toISOString() }).eq("id", aviso.id).select().single();
    if (error) { notify.error("Não foi possível atualizar o aviso."); return; }
    setAvisos((prev) => prev.map((item) => item.id === aviso.id ? data : item));
    notify.success(publicado ? "Aviso publicado no sistema." : "Aviso ocultado.");
  };

  const excluirAviso = async (aviso) => {
    if (!window.confirm(`Excluir o aviso “${aviso.titulo}”?`)) return;
    const { error } = await supabase.from("avisos").delete().eq("id", aviso.id);
    if (error) { notify.error("Não foi possível excluir o aviso."); return; }
    setAvisos((prev) => prev.filter((item) => item.id !== aviso.id));
    notify.success("Aviso excluído.");
  };

  return (
    <div className="flex w-full flex-col gap-6 text-slate-900 dark:text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle title={activeTab === "feedbacks" ? "Feedbacks da landing" : "Avisos e novidades"} subtitle={activeTab === "feedbacks" ? "Leia as avaliações recebidas e escolha quais podem aparecer na página inicial." : "Publique comunicados, novidades e atualizações para os usuários do Logview."} />
        {activeTab === "avisos" && <button type="button" onClick={openNovoAviso} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-800"><FaPlus size={12} /> Novo aviso</button>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
          <button type="button" onClick={() => { setActiveTab("feedbacks"); setBusca(""); }} className={`rounded-xl px-4 py-2 text-xs font-bold ${activeTab === "feedbacks" ? "bg-green-700 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}><FaStar className="mr-2 inline" /> Avaliações</button>
          <button type="button" onClick={() => { setActiveTab("avisos"); setBusca(""); }} className={`rounded-xl px-4 py-2 text-xs font-bold ${activeTab === "avisos" ? "bg-green-700 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}><FaBullhorn className="mr-2 inline" /> Avisos</button>
        </div>
        <div className="relative w-full sm:max-w-md"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={activeTab === "feedbacks" ? "Buscar feedback..." : "Buscar aviso..."} className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" /></div>
      </div>

      {loading ? <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-950"><FaSpinner className="animate-spin" /> Carregando...</div> : activeTab === "feedbacks" ? (
        filtered.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-950">Nenhum feedback encontrado.</div> : <div className="grid gap-4 lg:grid-cols-2">{filtered.map((feedback) => <article key={feedback.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><StarDisplay value={feedback.avaliacao} /><span className="text-xs text-slate-400">{feedback.avaliacao}/5</span></div><h2 className="mt-2 truncate font-bold">{feedback.titulo || "Sem título"}</h2><p className="mt-1 text-xs text-slate-400">{feedback.nome}{feedback.cargo ? ` · ${feedback.cargo}` : ""}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${feedback.publicado ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>{feedback.publicado ? "Na landing" : "Não publicado"}</span></div>{feedback.comentario && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">“{feedback.comentario}”</p>}<div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"><button type="button" onClick={() => setSelected(feedback)} className="text-xs font-semibold text-slate-500 hover:text-green-700">Ver detalhes</button><button type="button" disabled={saving || (!feedback.autoriza_publicacao && !feedback.publicado)} onClick={() => togglePublicacao(feedback)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${feedback.publicado ? "border border-red-200 text-red-600 hover:bg-red-50" : "bg-green-700 text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"}`}>{feedback.publicado ? <FaEyeSlash /> : <FaEye />}{feedback.publicado ? "Retirar da landing" : "Mostrar na landing"}</button></div></article>)}</div>
      ) : (
        filteredAvisos.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-950"><FaBullhorn className="mx-auto mb-3 text-2xl text-slate-300" /><p className="font-semibold">Nenhum aviso cadastrado</p><p className="mt-1 text-sm text-slate-400">Crie o primeiro comunicado para aparecer no sistema.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{filteredAvisos.map((aviso) => <article key={aviso.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700 dark:bg-green-950/50 dark:text-green-300">{TIPO_AVISO.find((x) => x.value === aviso.tipo)?.label || "Aviso"}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${aviso.publicado ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{aviso.publicado ? "Publicado" : "Oculto"}</span></div><span className="text-xs text-slate-400">{aviso.criado_em ? new Date(aviso.criado_em).toLocaleDateString("pt-BR") : ""}</span></div><h2 className="mt-4 text-base font-black">{aviso.titulo}</h2><p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{aviso.conteudo}</p><div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"><button type="button" onClick={() => toggleAviso(aviso)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">{aviso.publicado ? <FaEyeSlash /> : <FaEye />}{aviso.publicado ? "Ocultar" : "Publicar"}</button><button type="button" onClick={() => openEditarAviso(aviso)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"><FaEdit /> Editar</button><button type="button" onClick={() => excluirAviso(aviso)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><FaTrash /> Excluir</button></div></article>)}</div>
      )}

      {selected && <div className="fixed inset-0 z-[1100] flex items-center justify-center overflow-y-auto bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}><div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-slate-950"><div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><div><h3 className="font-bold">{selected.titulo || "Feedback"}</h3><p className="mt-1 text-xs text-slate-400">{selected.nome} · {selected.email}</p></div><button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">×</button></div><div className="flex flex-col gap-5 p-5 text-sm"><StarDisplay value={selected.avaliacao} /><p className="whitespace-pre-wrap leading-6 text-slate-700 dark:text-slate-300">{selected.comentario || "Sem comentário."}</p><div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400"><p>Autorizou publicação: <strong>{selected.autoriza_publicacao ? "Sim" : "Não"}</strong></p><p className="mt-1">Recomendaria: <strong>{selected.recomendaria == null ? "Não informado" : selected.recomendaria ? "Sim" : "Não"}</strong></p><p className="mt-1">Enviado em: <strong>{new Date(selected.criado_em).toLocaleString("pt-BR")}</strong></p></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold dark:border-slate-700">Fechar</button><button type="button" disabled={saving || (!selected.autoriza_publicacao && !selected.publicado)} onClick={() => togglePublicacao(selected)} className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><FaCheck /> {selected.publicado ? "Retirar publicação" : "Publicar na landing"}</button></div></div></div></div>}

      {avisoModal && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && !savingAviso && setAvisoModal(false)}><div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-950"><div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800"><p className="text-xs font-bold uppercase tracking-wider text-green-700">{selectedAviso ? "Editar publicação" : "Nova publicação"}</p><h3 className="mt-1 text-xl font-black">{selectedAviso ? "Atualizar aviso" : "Criar aviso"}</h3></div><div className="space-y-5 p-6"><div><label className="mb-2 block text-sm font-bold">Título</label><input maxLength={120} value={avisoForm.titulo} onChange={(e) => setAvisoForm((prev) => ({ ...prev, titulo: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" placeholder="Ex.: Nova funcionalidade disponível" /></div><div><label className="mb-2 block text-sm font-bold">Tipo</label><select value={avisoForm.tipo} onChange={(e) => setAvisoForm((prev) => ({ ...prev, tipo: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950">{TIPO_AVISO.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label className="mb-2 block text-sm font-bold">Conteúdo</label><textarea maxLength={4000} rows={7} value={avisoForm.conteudo} onChange={(e) => setAvisoForm((prev) => ({ ...prev, conteudo: e.target.value }))} className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" placeholder="Escreva o comunicado, novidade ou atualização..." /></div><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold dark:border-slate-700"><input type="checkbox" checked={avisoForm.publicado} onChange={(e) => setAvisoForm((prev) => ({ ...prev, publicado: e.target.checked }))} className="accent-green-700" /> Publicar imediatamente no sistema</label></div><div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800"><button type="button" onClick={() => setAvisoModal(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold dark:border-slate-700">Cancelar</button><button type="button" disabled={savingAviso} onClick={salvarAviso} className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{savingAviso && <FaSpinner className="animate-spin" />} {savingAviso ? "Salvando..." : selectedAviso ? "Salvar alterações" : "Publicar aviso"}</button></div></div></div>}
    </div>
  );
};
