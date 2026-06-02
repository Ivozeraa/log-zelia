import React from "react";

export const FormSelect = ({
  value,
  label,
  onChange,
  children,
  className = "",
  disabled = false,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-400">
        {label}
      </label>

      <div className={`${className} relative`}>
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`h-12 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 pr-8 text-slate-900 dark:text-white outline-none transition focus:border-slate-400 focus:ring-0 appearance-none ${
            disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : ""
          }`}
        >
          {children}
        </select>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
        >
          ▾
        </span>
      </div>
    </div>
  );
};