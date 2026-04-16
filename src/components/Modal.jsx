import { useEffect, useState } from "react"

export const Modal = ({ isOpen, onClose, children, title }) => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShow(true)
    } else {
      setTimeout(() => setShow(false), 200)
    }
  }, [isOpen])

  if (!show) return null

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0"
          }`}
      />

      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div
          onClick={(e) => e.stopPropagation()}
          className={`
            bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6
            transform transition-all duration-200
            ${isOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-4"}
          `}
        >
          {title && (
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
          )}

          <div className="text-gray-700">{children}</div>
        </div>
      </div>
    </>
  )
}