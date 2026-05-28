import React from "react";

export const FormSelect = ({
  value,
  label,
  onChange,
  children,
  className = "",
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-400">
        {label}
      </label>

      <select
        value={value}
        onChange={onChange}
        className={`h-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-slate-900 dark:text-white outline-none transition focus:border-slate-400 focus:ring-0 appearance-none ${className}`}
      >
        {children}
      </select>
    </div>
  );
};