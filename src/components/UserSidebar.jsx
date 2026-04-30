import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { FaRegUserCircle, FaUserEdit, FaSignOutAlt } from "react-icons/fa"
import { Modal } from "./Modal"
import { EditProfile } from "../pages/EditProfile"

export const UserSidebar = ({ open, setOpen }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (open || isModalOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }

    return () => {
      document.body.style.overflow = "auto"
    }
  }, [open, isModalOpen])

  function handleEditProfile() {
    setIsModalOpen(true)
    setOpen(false)
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm transition-opacity duration-200"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`
          fixed top-0 right-0 h-screen w-72
          bg-white shadow-lg z-9999
          flex flex-col items-center gap-5 p-10
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user?.nome || "Avatar"}
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <FaRegUserCircle size={50} />
        )}

        <p className="text-xl font-bold">{user?.nome || "Usuário"}</p>

        <div className="flex flex-col gap-3 w-full">
          <button
            type="button"
            onClick={handleEditProfile}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition"
          >
            <FaUserEdit />
            Editar Perfil
          </button>

          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-linear-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition"
          >
            <FaSignOutAlt />
            Deslogar
          </button>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Editar Perfil"
      >
        <EditProfile onClose={() => setIsModalOpen(false)} />
      </Modal>
    </>
  )
}