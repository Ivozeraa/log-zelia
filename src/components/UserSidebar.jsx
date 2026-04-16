import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { FaRegUserCircle, FaUserEdit, FaSignOutAlt } from "react-icons/fa"
import { Modal } from "./Modal"

export const UserSidebar = ({ open }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div
      className={`flex flex-col items-center gap-5 p-10 
      fixed top-0 right-0 h-screen w-72 bg-white shadow-lg z-50
      transform transition-all duration-250 ease-in-out
      ${open ? "translate-x-0" : "translate-x-full"}`}
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
          onClick={() => navigate("/editar-perfil")}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <FaUserEdit />
          Editar Perfil
        </button>

        <button
          type="button"
          onClick={logout}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-linear-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <FaSignOutAlt />
          Deslogar
        </button>
      </div>
    </div>
  )
}