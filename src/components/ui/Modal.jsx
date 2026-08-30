import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";

export const Modal = ({ isOpen, onClose, children, title }) => {
  const [show, setShow] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [viewport, setViewport] = useState({
    height: typeof window !== "undefined" ? window.innerHeight : 800,
    top: 0,
  });

  useEffect(() => {
    let timeout;
    if (isOpen) {
      setShow(true);
      document.body.style.overflow = "hidden";
      timeout = setTimeout(() => setAnimate(true), 10);
    } else {
      setAnimate(false);
      document.body.style.overflow = "";
      timeout = setTimeout(() => setShow(false), 200);
    }
    return () => clearTimeout(timeout);
  }, [isOpen]);

  // O visualViewport é essencial no iOS: quando o teclado aparece, o viewport
  // visual fica menor que o layout viewport. O modal acompanha essa área para
  // nunca ficar atrás do teclado ou ter seu conteúdo cortado.
  useEffect(() => {
    const updateViewport = () => {
      const vv = window.visualViewport;
      setViewport({
        height: vv?.height || window.innerHeight,
        top: vv?.offsetTop || 0,
      });
    };

    updateViewport();
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  if (!show) return null;

  const modalHeight = Math.max(viewport.height - 16, 240);

  return createPortal(
    <div
      className="fixed z-[9999] w-full"
      style={{
        top: `${viewport.top}px`,
        height: `${viewport.height}px`,
      }}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 z-[9998] bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${animate ? "opacity-100" : "opacity-0"}`}
      />

      <div
        className="relative z-[9999] flex h-full w-full items-start justify-center overflow-y-auto overscroll-contain px-2 py-2 sm:px-4 sm:py-6 sm:items-center"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className={`my-auto flex w-[calc(100vw-1rem)] min-w-0 max-w-[56rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950 sm:w-full transform transition-all duration-200 ${animate ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
          style={{
            maxHeight: `${modalHeight}px`,
            height: "auto",
          }}
        >
          {title && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6 sm:py-4">
              <h2 className="min-w-0 truncate text-lg font-semibold text-slate-900 dark:text-white sm:text-2xl">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar modal"
                className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <FaTimes />
              </button>
            </div>
          )}
          <div
            className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-3 sm:px-6 sm:pb-6 sm:pt-4"
            style={{ WebkitOverflowScrolling: "touch" }}
            onFocusCapture={(event) => {
              const target = event.target;
              if (!target || typeof target.scrollIntoView !== "function") return;
              window.setTimeout(() => {
                target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
              }, 120);
            }}
          >
            <div className="min-w-0 w-full">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
