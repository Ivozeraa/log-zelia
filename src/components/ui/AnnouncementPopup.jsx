import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaBell, FaBullhorn, FaTimes, FaRocket, FaSyncAlt } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import { supabase } from "../../utils/supabase";
import { useAuth } from "../../hooks/useAuth";

const SEEN_PREFIX = "logview_announcement_seen_v1";
const icons = { aviso: FaBell, novidade: FaRocket, atualizacao: FaSyncAlt };
const labels = { aviso: "Aviso", novidade: "Novidade", atualizacao: "Atualização" };
const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "BR", "P", "UL", "OL", "LI"]);

const sanitizeRichText = (value) => {
  if (!value || typeof document === "undefined") return value || "";
  const doc = new DOMParser().parseFromString(value, "text/html");
  const sanitizeNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(node.tagName)) {
      const parent = node.parentNode;
      if (parent) {
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        node.remove();
      }
      return;
    }
    Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
    Array.from(node.childNodes).forEach(sanitizeNode);
  };
  Array.from(doc.body.childNodes).forEach(sanitizeNode);
  return doc.body.innerHTML;
};

export function AnnouncementPopup() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    if (loading || !user || !location.pathname.startsWith("/app")) return;
    let cancelled = false;

    const load = async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("avisos")
        .select("id, titulo, conteudo, tipo, inicio_em, fim_em, publicado, criado_em")
        .eq("publicado", true)
        .or(`inicio_em.is.null,inicio_em.lte.${now}`)
        .or(`fim_em.is.null,fim_em.gt.${now}`)
        .order("criado_em", { ascending: false });

      if (cancelled || error) return;

      const seenRaw = localStorage.getItem(`${SEEN_PREFIX}_${user.id}`);
      let seen = [];
      try {
        seen = JSON.parse(seenRaw || "[]");
      } catch {
        seen = [];
      }

      const next = (data || []).find((item) => !seen.includes(item.id));
      if (next) setAnnouncement(next);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [loading, user, location.pathname]);

  if (!announcement || !user) return null;

  const Icon = icons[announcement.tipo] || FaBullhorn;
  const contentHtml = sanitizeRichText(announcement.conteudo);

  const close = () => {
    const key = `${SEEN_PREFIX}_${user.id}`;
    let seen = [];

    try {
      seen = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      seen = [];
    }

    const next = Array.from(new Set([...seen, announcement.id])).slice(-100);
    localStorage.setItem(key, JSON.stringify(next));
    setAnnouncement(null);
  };

  const popup = (
    <div
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
    >
      <div className="flex w-full max-w-lg max-h-[78dvh] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950 sm:max-h-[72dvh]">
        <div className="relative shrink-0 bg-gradient-to-br from-green-700 via-emerald-600 to-teal-600 px-5 pb-5 pt-5 text-white sm:px-6">
          <button
            type="button"
            onClick={close}
            aria-label="Fechar aviso"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <FaTimes size={13} />
          </button>

          <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-white/15">
            <Icon size={18} />
          </div>

          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
            {labels[announcement.tipo] || "Aviso"}
          </span>

          <h2 id="announcement-title" className="mt-2 pr-10 text-xl font-black leading-tight tracking-tight sm:text-2xl">
            {announcement.titulo}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          <div
            className="text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-[15px] sm:leading-7 [&_p]:m-0 [&_p+_p]:mt-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
          <button
            type="button"
            onClick={close}
            className="w-full rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
