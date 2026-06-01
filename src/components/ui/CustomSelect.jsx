import { useEffect, useRef, useState } from "react";

export const CustomSelect = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Selecione...",
  disabled = false,
  className = "",
  emptyLabel = "Nenhum item encontrado",
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={`relative flex flex-col gap-1 ${className}`} ref={rootRef}>
      {label && (
        <label className="text-sm font-semibold text-slate-700">{label}</label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-3 text-left text-slate-900 outline-none transition focus:border-slate-400 focus:ring-0 ${disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : ""
          }`}
      >
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-slate-500">▾</span>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-slate-500">{emptyLabel}</div>
          )}
        </div>
      )}
    </div>
  );
};
