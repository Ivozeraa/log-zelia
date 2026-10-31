import { useEffect, useRef, useState } from "react";
import {
  FaBars, FaBookOpen, FaChevronDown, FaHome, FaLock, FaPrint,
  FaQuestionCircle, FaSignOutAlt, FaSyncAlt
} from "react-icons/fa";

export function StudentActionsMenu({
  onOverview, onHistory, onRefresh, onPrint, onSecurity, onHelp, onExit, refreshing
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const firstItemRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    firstItemRef.current?.focus();
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const choose = (action) => {
    setOpen(false);
    action();
  };

  const options = [
    { label: "Visão geral", icon: FaHome, action: onOverview },
    { label: "Histórico de registros", icon: FaBookOpen, action: onHistory },
    { label: "Atualizar histórico", icon: FaSyncAlt, action: onRefresh, disabled: refreshing },
    { label: "Imprimir / salvar PDF", icon: FaPrint, action: onPrint },
    { label: "Segurança da conta", icon: FaLock, action: onSecurity },
    { label: "Orientações", icon: FaQuestionCircle, action: onHelp },
    { label: "Sair do painel", icon: FaSignOutAlt, action: onExit, danger: true },
  ];

  return (
    <div ref={rootRef} className="relative print:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <FaBars aria-hidden="true" />
        Menu
        <FaChevronDown aria-hidden="true" className={`text-[10px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" aria-label="Menu do aluno" className="absolute right-0 top-full z-[100] mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20">
          {options.map(({ label, icon: Icon, action, disabled, danger }, index) => (
            <button
              key={label}
              ref={index === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => choose(action)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-green-600/30 disabled:opacity-50 ${danger ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"}`}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 opacity-75" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
