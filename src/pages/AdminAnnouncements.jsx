import { useCallback, useEffect, useMemo, useState } from "react";
import { FaBullhorn, FaEdit, FaPlus, FaSpinner, FaTrash, FaEye, FaEyeSlash } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { supabase } from "../utils/supabase";
import { notify } from "../utils/notify";

const TIPOS = [
  { value: "aviso", label: "Aviso" },
  { value: "novidade", label: "Novidade" },
  { value: "atualizacao", label: "Atualização" },
];

const EMPTY_FORM = { titulo: "", conteudo: "", tipo: "aviso", publicado: true };

const TipoBadge = ({ tipo }) => {
  const label = TIPOS.find((item) => item.value === tipo)?.label || "Aviso";
  return <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700 dark:bg-green-950/50 dark:text-green-300">{label}</span>;
};

export const AdminAnnouncements = () => {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busca, setBusca] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("avisos").select("*").order("criado_em", { ascending: false });
    if (error) {
      console.error(error);
      notify.error("Não foi possível carregar os avisos.");
      setAvisos([]);
    } else setAvisos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return avisos;
    return avisos.filter((item) => [item.titulo, item.conteudo, item.tipo].some((value) => value?.toLowerCase().includes(term)));
  }, [avisos, busca]);

  const openCreate = () => { setSelected(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (item) => { setSelected(item); setForm({ titulo: item.titulo || "", conteudo: item.conteudo || "", tipo: item.tipo || "aviso", publicado: item.publicado !== false }); setModalOpen(true); };
  const closeModal = () => { if (!saving) { setModalOpen(false); setSelected(null); } };

  const save = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      notify.warning("Informe o título e o conteúdo do aviso.");
      return;
    }
    setSaving(true);
    const payload = { titulo: form.titulo.trim(), conteudo: form.conteudo.trim(), tipo: form.tipo, publicado: form.publicado };
    const result = selected
      ? await supabase.from("avisos").update(payload).eq("id", selected.id).select().single()
      : await supabase.from("avisos").insert(payload).select().single();
    setSaving(false);
    if (result.error) {
      console.error(result.error);
      notify.error("Não foi possível salvar o aviso. Verifique se a tabela 'avisos' existe no Supabase.");
      return;
    }
    setAvisos((prev) => selected ? prev.map((item) => item.id === selected.id ? result.data : item) : [result.data, ...prev]);
    notify.success(selected ? "Aviso atualizado." : "Aviso criado.");
    closeModal();
  };

  const togglePublicado = async (item) => {
    const publicado = !item.publicado;
    const { data, error } = await supabase.from("avisos").update({ publicado }).eq("id", item.id).select().single();
    if (error) { notify.error("Não foi possível atualizar a publicação."); return; }
    setAvisos((prev) => prev.map((current) => current.id === item.id ? data : current));
    notify.success(publicado ? "Aviso publicado." : "Aviso ocultado.");
  };

  const remove = async (item) => {
    if (!window.confirm(`Excluir o aviso “${item.titulo}”?`)) return;
    const { error } = await supabase.from("avisos").delete().eq("id", item.id);
    if (error) { notify.error("Não foi possível excluir o aviso."); return; }
    setAvisos((prev) => prev.filter((current) => current.id !== item.id));
    notify.success("Aviso excluído.");
  };

  return (
    <div className="flex w-full flex-col gap-6 text-slate-900 dark:text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle title="Avisos e novidades" subtitle="Publique comunicados, novidades e atualizações para os usuários do Logview." />
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-800"><FaPlus size={12} /> Novo aviso</button>
      </div>

      <div className="relative w-full sm:max-w-md"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar avisos..." className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" /></div>

      {loading ? <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-950"><FaSpinner className="animate-spin" /> Carregando...</div> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-950"><FaBullhorn className="mx-auto mb-3 text-2xl text-slate-300" /><p className="font-semibold">Nenhum aviso cadastrado</p><p className="mt-1 text-sm text-slate-400">Crie o primeiro comunicado para aparecer no sistema.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{filtered.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><TipoBadge tipo={item.tipo} /><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.publicado ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{item.publicado ? "Publicado" : "Oculto"}</span></div><span className="text-xs text-slate-400">{item.criado_em ? new Date(item.criado_em).toLocaleDateString("pt-BR") : ""}</span></div><h2 className="mt-4 text-base font-black">{item.titulo}</h2><p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{item.conteudo}</p><div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"><button type="button" onClick={() => togglePublicado(item)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">{item.publicado ? <FaEyeSlash /> : <FaEye />}{item.publicado ? "Ocultar" : "Publicar"}</button><button type="button" onClick={() => openEdit(item)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"><FaEdit /> Editar</button><button type="button" onClick={() => remove(item)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-950"><FaTrash /> Excluir</button></div></article>)}</div>}

      {modalOpen && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}><div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-950"><div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800"><p className="text-xs font-bold uppercase tracking-wider text-green-700">{selected ? "Editar publicação" : "Nova publicação"}</p><h2 className="mt-1 text-xl font-black">{selected ? "Atualizar aviso" : "Criar aviso"}</h2></div><div className="space-y-5 p-6"><div><label className="mb-2 block text-sm font-bold">Título</label><input maxLength={120} value={form.titulo} onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))} placeholder="Ex.: Nova funcionalidade disponível" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" /></div><div><label className="mb-2 block text-sm font-bold">Tipo</label><select value={form.tipo} onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950">{TIPOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label className="mb-2 block text-sm font-bold">Conteúdo</label><textarea maxLength={4000} rows={7} value={form.conteudo} onChange={(e) => setForm((prev) => ({ ...prev, conteudo: e.target.value }))} placeholder="Escreva o comunicado..." className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-950" /></div><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold dark:border-slate-700"><input type="checkbox" checked={form.publicado} onChange={(e) => setForm((prev) => ({ ...prev, publicado: e.target.checked }))} className="accent-green-700" /> Publicar imediatamente no sistema</label></div><div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800"><button type="button" onClick={closeModal} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold dark:border-slate-700">Cancelar</button><button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving && <FaSpinner className="animate-spin" />} {saving ? "Salvando..." : selected ? "Salvar alterações" : "Publicar aviso"}</button></div></div></div>}
    </div>
  );
};
