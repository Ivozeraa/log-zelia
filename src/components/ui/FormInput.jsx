import React from "react";

export const FormInput = ({
  type = "text",
  label,
  value,
  onChange,
  placeholder,
  className = "",
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-400">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`h-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-slate-900 dark:text-white outline-none transition focus:border-green-800 focus:ring-2 focus:ring-green-200 ${className}`}
      />
    </div>
  );
};