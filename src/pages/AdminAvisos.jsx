import { useEffect, useMemo, useState } from "react";
import { FaBell, FaEdit, FaPlus, FaTrash, FaCheck, FaTimes } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { supabase } from "../utils/supabase";
import { notify } from "../utils/notify";

const TYPES = [
  { value: "aviso", label: "Aviso" },
  { value: "novidade", label: "Novidade" },
  { value: "atualizacao", label: "Atualização" },
];

const emptyForm = { titulo: "", conteudo: "", tipo: "aviso", publicado: true, inicio_em: "", fim_em: "" };

const toInputDateTime = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";
const fromInputDateTime = (value) => value ? new Date(value).toISOString() : null;

export const AdminAvisos = () => {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("avisos").select("*").order("criado_em", { ascending: false });
    if (error) notify.error("Não foi possível carregar os avisos.");
    else setAvisos(data || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const status = (aviso) => {
    if (!aviso.publicado) return { label: "Oculto", cls: "bg-slate-100 text-slate-500" };
    const now = Date.now();
    const start = aviso.inicio_em ? new Date(aviso.inicio_em).getTime() : -Infinity;
    const end = aviso.fim_em ? new Date(aviso.fim_em).getTime() : Infinity;
    if (now < start) return { label: "Programado", cls: "bg-amber-100 text-amber-700" };
    if (now >= end) return { label: "Expirado", cls: "bg-slate-100 text-slate-500" };
    return { label: "Em exibição", cls: "bg-green-100 text-green-700" };
  };

  const openCreate = () => { setSelected(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (item) => {
    setSelected(item);
    setForm({ titulo: item.titulo || "", conteudo: item.conteudo || "", tipo: item.tipo || "aviso", publicado: item.publicado !== false, inicio_em: toInputDateTime(item.inicio_em), fim_em: toInputDateTime(item.fim_em) });
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.titulo.trim() || !form.conteudo.trim()) return notify.warning("Preencha o título e o conteúdo.");
    if (form.inicio_em && form.fim_em && new Date(form.fim_em) <= new Date(form.inicio_em)) return notify.warning("O término deve ser posterior ao início.");
    setSaving(true);
    const payload = { titulo: form.titulo.trim(), conteudo: form.conteudo.trim(), tipo: form.tipo, publicado: form.publicado, inicio_em: fromInputDateTime(form.inicio_em), fim_em: fromInputDateTime(form.fim_em), atualizado_em: new Date().toISOString() };
    const result = selected ? await supabase.from("avisos").update(payload).eq("id", selected.id).select().single() : await supabase.from("avisos").insert(payload).select().single();
    setSaving(false);
    if (result.error) return notify.error("Não foi possível salvar o aviso.");
    notify.success(selected ? "Aviso atualizado." : "Aviso criado.");
    setModalOpen(false);
    await load();
  };

  const togglePublished = async (item) => {
    const { error } = await supabase.from("avisos").update({ publicado: !item.publicado, atualizado_em: new Date().toISOString() }).eq("id", item.id);
    if (error) return notify.error("Não foi possível alterar a publicação.");
    await load();
  };

  const remove = async (item) => {
    if (!window.confirm(`Excluir o aviso “${item.titulo}”?`)) return;
    const { error } = await supabase.from("avisos").delete().eq("id", item.id);
    if (error) return notify.error("Não foi possível excluir o aviso.");
    notify.success("Aviso excluído.");
    await load();
  };

  const visibleCount = useMemo(() => avisos.filter((item) => status(item).label === "Em exibição").length, [avisos]);

  return (
    <div className="flex w-full flex-col gap-6 text-slate-900 dark:text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle title="Avisos e novidades" subtitle="Programe comunicados para aparecerem como pop-up aos usuários." />
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-800"><FaPlus /> Novo aviso</button>
      </div>

      <div className="rounded-2xl border border-green-100 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"><FaBell /></div><div><p className="text-sm font-bold">{visibleCount} aviso{visibleCount === 1 ? "" : "s"} em exibição agora</p><p className="text-xs text-slate-500 dark:text-slate-400">Cada aviso é reconhecido individualmente. Depois que o usuário o fecha, ele não volta a aparecer para ele.</p></div></div>
      </div>

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-950">Carregando...</div> : avisos.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-950">Nenhum aviso cadastrado.</div> : <div className="grid gap-4 lg:grid-cols-2">{avisos.map((item) => { const s = status(item); return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{TYPES.find((x) => x.value === item.tipo)?.label || item.tipo}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${s.cls}`}>{s.label}</span></div><h2 className="mt-3 text-lg font-black">{item.titulo}</h2></div><div className="flex gap-1"><button type="button" onClick={() => openEdit(item)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><FaEdit /></button><button type="button" onClick={() => remove(item)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><FaTrash /></button></div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{item.conteudo}</p><div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2"><div>Início: <strong>{item.inicio_em ? new Date(item.inicio_em).toLocaleString("pt-BR") : "Imediato"}</strong></div><div>Fim: <strong>{item.fim_em ? new Date(item.fim_em).toLocaleString("pt-BR") : "Sem término"}</strong></div></div><div className="mt-5 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800"><button type="button" onClick={() => togglePublished(item)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${item.publicado ? "border border-red-200 text-red-600 hover:bg-red-50" : "bg-green-700 text-white hover:bg-green-800"}`}>{item.publicado ? <><FaTimes /> Ocultar</> : <><FaCheck /> Publicar</>}</button></div></article>; })}</div>}

      {modalOpen && <div className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}><form onSubmit={save} className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-950"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">{selected ? "Editar aviso" : "Novo aviso"}</h2><p className="mt-1 text-xs text-slate-400">Defina o conteúdo e a janela em que ele poderá aparecer.</p></div><button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">×</button></div><div className="mt-6 grid gap-4"><label className="text-sm font-semibold">Título<input value={form.titulo} maxLength={120} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-green-600 dark:border-slate-700 dark:bg-slate-900" /></label><label className="text-sm font-semibold">Tipo<select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">{TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label className="text-sm font-semibold">Conteúdo<textarea value={form.conteudo} maxLength={4000} rows={6} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-green-600 dark:border-slate-700 dark:bg-slate-900" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Começa em<input type="datetime-local" value={form.inicio_em} onChange={(e) => setForm({ ...form, inicio_em: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900" /></label><label className="text-sm font-semibold">Termina em<input type="datetime-local" value={form.fim_em} onChange={(e) => setForm({ ...form, fim_em: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900" /></label></div><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.publicado} onChange={(e) => setForm({ ...form, publicado: e.target.checked })} className="accent-green-700" /> Publicado</label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold dark:border-slate-700">Cancelar</button><button type="submit" disabled={saving} className="rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar aviso"}</button></div></form></div>}
    </div>
  );
};
