import { useEffect, useState } from "react"

export const Modal = ({ isOpen, onClose, children, title }) => {
  const [show, setShow] = useState(false)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    let timeout

    if (isOpen) {
      setShow(true)

      timeout = setTimeout(() => {
        setAnimate(true)
      }, 10)
    } else {
      setAnimate(false)

      timeout = setTimeout(() => {
        setShow(false)
      }, 200)
    }

    return () => clearTimeout(timeout)
  }, [isOpen])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
          animate ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh]
          border border-slate-200/70
          transform transition-all duration-200
          ${
            animate
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-4"
          }
        `}
      >
        {title && (
          <div className="flex flex-col gap-3 px-6 py-4 border-b border-slate-200/80 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">
              {title}
            </h2>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              ×
            </button>
          </div>
        )}

        <div className="text-slate-700 max-h-[calc(92vh-6rem)] overflow-y-auto px-6 pb-6 pt-4">
          {children}
        </div>
      </div>
    </div>
  )
}