export const ConfigSwitch = ({ title, active = false, onClick }) => {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>

      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={`${title}: ${active ? "ativado" : "desativado"}`}
        className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500/30 ${
          active
            ? "border-green-600 bg-green-600 dark:border-green-500 dark:bg-green-500"
            : "border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            active ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
};
