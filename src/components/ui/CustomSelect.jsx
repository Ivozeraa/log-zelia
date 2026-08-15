import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  showSelectedValues = true,
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [menuMinWidth, setMenuMinWidth] = useState(240);
  const [menuPosition, setMenuPosition] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const labels = [placeholder, ...options.map((option) => option.label)];
    const maxLength = Math.max(0, ...labels.map((item) => String(item || "").length));
    setMenuMinWidth(Math.min(Math.max(240, Math.round(maxLength * 7.2 + 72)), 720));
  }, [options, placeholder]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        rootRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
      setSearchTerm("");
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) return undefined;

    const updatePosition = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 8;
      const width = Math.min(
        Math.max(rect.width, menuMinWidth),
        window.innerWidth - viewportPadding * 2,
      );
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - width - viewportPadding),
      );

      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
      const spaceAbove = rect.top - viewportPadding - gap;
      const openAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        180,
        Math.min(380, openAbove ? spaceAbove : spaceBelow),
      );
      const top = openAbove
        ? Math.max(viewportPadding, rect.top - maxHeight - gap)
        : rect.bottom + gap;

      setMenuPosition({ top, left, width, maxHeight });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, menuMinWidth]);

  const selectedValues = multiple ? (Array.isArray(value) ? value : []) : null;

  const getDisplayLabel = () => {
    if (multiple) {
      if (!selectedValues?.length) return placeholder;
      if (selectedValues.length === 1) {
        return options.find((option) => option.value === selectedValues[0])?.label ?? placeholder;
      }
      return `${selectedValues.length} itens selecionados`;
    }
    return options.find((option) => option.value === value)?.label ?? placeholder;
  };

  const handleOptionClick = (optionValue) => {
    if (multiple) {
      if (optionValue === "") return;
      const current = Array.isArray(value) ? value : [];
      onChange(
        current.includes(optionValue)
          ? current.filter((item) => item !== optionValue)
          : [...current, optionValue],
      );
      return;
    }

    onChange(optionValue);
    setOpen(false);
    setSearchTerm("");
  };

  const filteredOptions = showSearch
    ? options.filter(
        (option) =>
          option.value === "" ||
          option.label.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : options;

  const displayedOptions = multiple
    ? filteredOptions.filter((option) => option.value !== "")
    : filteredOptions;

  return (
    <div ref={rootRef} className={`relative flex flex-col gap-2 ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-400">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) setSearchTerm("");
          setOpen((previous) => !previous);
        }}
        className={`flex h-12 w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-3 text-left text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white ${
          disabled ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800" : ""
        }`}
      >
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {getDisplayLabel()}
        </span>
        <span className="ml-2 shrink-0 text-slate-500">▾</span>
      </button>

      {multiple && showSelectedValues && selectedValues?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((valueItem) => {
            const option = options.find((item) => item.value === valueItem);
            return (
              <span
                key={valueItem}
                className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
              >
                {option?.label ?? valueItem}
                <button
                  type="button"
                  onClick={() => handleOptionClick(valueItem)}
                  className="ml-0.5 text-green-600 hover:text-green-900"
                  aria-label={`Remover ${option?.label}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {open && !disabled && menuPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[10050] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            height: menuPosition.maxHeight,
            maxHeight: menuPosition.maxHeight,
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          {showSearch && (
            <div className="border-b border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
              <input
                autoFocus
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}

          <div
            className="overflow-y-scroll overscroll-contain"
            style={{
              height: multiple
                ? `calc(100% - ${showSearch ? 112 : 52}px)`
                : `calc(100% - ${showSearch ? 60 : 0}px)`,
              WebkitOverflowScrolling: "touch",
              scrollbarGutter: "stable",
              touchAction: "pan-y",
            }}
          >
            {displayedOptions.length > 0 ? (
              displayedOptions.map((option) => {
                const isSelected = multiple && selectedValues?.includes(option.value);
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
                        {isSelected && "✓"}
                      </span>
                    )}
                    <span className="min-w-0 truncate">{option.label}</span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-sm text-slate-500">{emptyLabel}</div>
            )}
          </div>

          {multiple && (
            <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
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
        </div>,
        document.body,
      )}
    </div>
  );
};
