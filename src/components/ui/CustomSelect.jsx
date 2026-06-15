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
  showSearch = false,
  multiple = false,
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --- lógica de seleção múltipla ---
  const selectedValues = multiple ? (Array.isArray(value) ? value : []) : null;

  const getDisplayLabel = () => {
    if (multiple) {
      if (!selectedValues || selectedValues.length === 0) return placeholder;
      if (selectedValues.length === 1) {
        return (
          options.find((o) => o.value === selectedValues[0])?.label ??
          placeholder
        );
      }
      return `${selectedValues.length} alunos selecionados`;
    }
    return options.find((o) => o.value === value)?.label ?? placeholder;
  };

  const handleOptionClick = (optionValue) => {
    if (multiple) {
      if (optionValue === "") return; // ignora placeholder
      const current = Array.isArray(value) ? value : [];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      onChange(next);
      // mantém o dropdown aberto para selecionar mais
    } else {
      onChange(optionValue);
      setOpen(false);
      setSearchTerm("");
    }
  };

  const filteredOptions = showSearch
    ? options.filter(
        (option) =>
          option.value === "" ||
          option.label.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : options;

  // no modo múltiplo, remove a opção-placeholder do dropdown
  const displayedOptions = multiple
    ? filteredOptions.filter((o) => o.value !== "")
    : filteredOptions;

  return (
    <div className={`relative flex flex-col gap-2 ${className}`} ref={rootRef}>
      {label && (
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-400">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) setSearchTerm("");
          setOpen((prev) => !prev);
        }}
        className={`flex h-12 w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-3 text-left text-slate-900 outline-none transition focus:border-slate-400 focus:ring-0 dark:border-slate-700 dark:bg-slate-950 dark:text-white ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800"
            : ""
        }`}
      >
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {getDisplayLabel()}
        </span>
        <span className="text-slate-500">▾</span>
      </button>

      {/* badges dos alunos selecionados */}
      {multiple && selectedValues && selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((v) => {
            const opt = options.find((o) => o.value === v);
            return (
              <span
                key={v}
                className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
              >
                {opt?.label ?? v}
                <button
                  type="button"
                  onClick={() => handleOptionClick(v)}
                  className="ml-0.5 text-green-600 hover:text-green-900"
                  aria-label={`Remover ${opt?.label}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {showSearch && (
            <div className="sticky top-0 border-b border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}

          {displayedOptions.length > 0 ? (
            displayedOptions.map((option) => {
              const isSelected =
                multiple && selectedValues?.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleOptionClick(option.value)}
                  className={`flex w-full items-center gap-2 px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800 ${
                    isSelected ? "bg-green-50 dark:bg-green-950" : ""
                  }`}
                >
                  {multiple && (
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          viewBox="0 0 10 8"
                          fill="none"
                          className="h-2.5 w-2.5"
                        >
                          <path
                            d="M1 4l2.5 2.5L9 1"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  )}
                  {option.label}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3 text-sm text-slate-500">{emptyLabel}</div>
          )}

          {/* botão de confirmar no modo múltiplo */}
          {multiple && (
            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSearchTerm("");
                }}
                className="w-full rounded-xl bg-green-700 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
              >
                Confirmar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
