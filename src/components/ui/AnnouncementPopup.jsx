import { useEffect, useState } from "react";
import { FaBell, FaBullhorn, FaTimes, FaRocket, FaSyncAlt } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import { supabase } from "../../utils/supabase";
import { useAuth } from "../../hooks/useAuth";

const SEEN_PREFIX = "logview_announcement_seen_v1";
const icons = { aviso: FaBell, novidade: FaRocket, atualizacao: FaSyncAlt };
const labels = { aviso: "Aviso", novidade: "Novidade", atualizacao: "Atualização" };

export function AnnouncementPopup() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    if (loading || !user || !location.pathname.startsWith("/app")) return;
    let cancelled = false;

    const load = async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase.from("avisos").select("id, titulo, conteudo, tipo, inicio_em, fim_em, publicado, criado_em").eq("publicado", true).or(`inicio_em.is.null,inicio_em.lte.${now}`).or(`fim_em.is.null,fim_em.gt.${now}`).order("criado_em", { ascending: false });
      if (cancelled || error) return;
      const seenRaw = localStorage.getItem(`${SEEN_PREFIX}_${user.id}`);
      let seen = [];
      try { seen = JSON.parse(seenRaw || "[]"); } catch { seen = []; }
      const next = (data || []).find((item) => !seen.includes(item.id));
      if (next) setAnnouncement(next);
    };

    void load();
    return () => { cancelled = true; };
  }, [loading, user, location.pathname]);

  if (!announcement || !user) return null;

  const Icon = icons[announcement.tipo] || FaBullhorn;
  const close = () => {
    const key = `${SEEN_PREFIX}_${user.id}`;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(key) || "[]"); } catch { seen = []; }
    const next = Array.from(new Set([...seen, announcement.id])).slice(-100);
    localStorage.setItem(key, JSON.stringify(next));
    setAnnouncement(null);
  };

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="relative bg-gradient-to-br from-green-700 via-emerald-600 to-teal-600 px-6 pb-7 pt-6 text-white">
          <button type="button" onClick={close} aria-label="Fechar aviso" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"><FaTimes size={13} /></button>
          <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Icon size={21} /></div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">{labels[announcement.tipo] || "Aviso"}</span>
          <h2 className="mt-3 pr-8 text-2xl font-black tracking-tight">{announcement.titulo}</h2>
        </div>
        <div className="px-6 py-6">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">{announcement.conteudo}</p>
          <button type="button" onClick={close} className="mt-6 w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white hover:bg-green-800">Entendi</button>
        </div>
      </div>
    </div>
  );
}
