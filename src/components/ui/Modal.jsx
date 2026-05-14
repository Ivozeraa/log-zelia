import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { FaMixcloud } from "react-icons/fa"

export const Modal = ({ isOpen, onClose, children, title }) => {
  const [show, setShow] = useState(false)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    let timeout

    if (isOpen) {
      setShow(true)
      document.body.style.overflow = "hidden"

      timeout = setTimeout(() => {
        setAnimate(true)
      }, 10)
    } else {
      setAnimate(false)
      document.body.style.overflow = ""

      timeout = setTimeout(() => {
        setShow(false)
      }, 200)
    }

    return () => clearTimeout(timeout)
  }, [isOpen])

  if (!show) return null

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center px-4 py-6">

      <div
        onClick={onClose}
        className={`
          absolute inset-0 z-9998
          bg-black/50 backdrop-blur-sm
          transition-opacity duration-200
          ${animate ? "opacity-100" : "opacity-0"}
        `}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          relative z-9999
          bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh]
          border border-slate-200/70
          transform transition-all duration-200
          ${animate
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4"
          }
        `}
      >
        {title && (
          <div className="flex items-center justify-between w-full px-6 py-4 border-b border-slate-200/80">
            <h2 className="text-2xl font-semibold text-slate-900">
              {title}
            </h2>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <FaMixcloud />
            </button>
          </div>
        )}

        <div className="text-slate-700 max-h-[calc(92vh-6rem)] overflow-y-auto px-6 pb-6 pt-4">
          {children}
        </div>
      </div>

    </div>,
    document.body
  )
}