import React from "react";

export const FormInput = ({
  type = "text",
  label,
  value,
  checked,
  onChange,
  placeholder,
  className = "",
  disabled = false,
  id,
  name,
  ...props
}) => {
  const inputClass = `h-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-slate-900 dark:text-white outline-none transition focus:border-slate-400 focus:ring-0 ${className}`;

  if (type === "checkbox") {
    if (label) {
      return (
        <label className={`inline-flex items-center gap-2 ${className}`} htmlFor={id}>
          <input
            id={id}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="h-4 w-4 rounded border-slate-300 text-green-700 focus:ring-green-600"
            {...props}
          />
          <span className="text-sm text-slate-700 dark:text-slate-400">{label}</span>
        </label>
      );
    }

    return (
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={`h-4 w-4 rounded border-slate-300 text-green-700 focus:ring-green-600 ${className}`}
        {...props}
      />
    );
  }

  if (!label) {
    return (
      <input
        id={id}
        name={name}
        type={type}
        value={type === "file" ? undefined : value}
        checked={type === "checkbox" ? checked : undefined}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClass}
        {...props}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-sm font-semibold text-slate-700 dark:text-slate-400"
      >
        {label}
      </label>

      <input
        id={id}
        name={name}
        type={type}
        value={type === "file" ? undefined : value}
        checked={type === "checkbox" ? checked : undefined}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClass}
        {...props}
      />
    </div>
  );
};