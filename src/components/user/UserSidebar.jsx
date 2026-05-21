import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { FaRegUserCircle, FaUserEdit, FaSignOutAlt } from "react-icons/fa"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { EditProfile } from "./EditProfile"

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
          className="fixed inset-0 z-9998 bg-black/50 backdrop-blur-sm transition-opacity duration-200"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`
          fixed top-0 right-0 h-screen w-72
          bg-white dark:bg-slate-950 shadow-lg z-9999
          border-l-2 border-gray-300 dark:border-slate-700
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

        <p className="text-xl font-bold text-slate-900 dark:text-white">
          {user?.nome || "Usuário"}
        </p>

        <div className="flex flex-col gap-3 w-full">
          <Button
            type="button"
            className="flex items-center justify-center gap-2"
            onClick={handleEditProfile}
          >
            <FaUserEdit />
            Editar Perfil
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="flex items-center justify-center gap-2"
            onClick={logout}
          >
            <FaSignOutAlt />
            Deslogar
          </Button>
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