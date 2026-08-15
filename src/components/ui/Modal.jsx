import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";

export const Modal = ({ isOpen, onClose, children, title }) => {
  const [show, setShow] = useState(false);
  const [animate, setAnimate] = useState(false);

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

  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${animate ? "opacity-100" : "opacity-0"}`}
      />

      <div className="relative z-[9999] flex min-h-full w-full items-start justify-center overflow-y-auto px-4 py-6 sm:items-center">
        <div
          onClick={(event) => event.stopPropagation()}
          className={`my-auto flex max-h-[calc(100dvh-2rem)] w-fit min-w-[min(92vw,32rem)] max-w-[min(94vw,54rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950 transform transition-all duration-200 ${animate ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
        >
          {title && (
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h2>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"><FaTimes /></button>
            </div>
          )}
          <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-visible px-6 pb-6 pt-4">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
