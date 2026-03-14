import { useAuth } from "../contexts/AuthContext"

import { FaRegUserCircle } from "react-icons/fa"

export const UserSidebar = ({ open }) => {

  const { user } = useAuth()

  return (
    <div
      className={`flex flex-col items-center gap-5 p-10 
      fixed top-0 right-0 h-screen w-72 bg-white shadow-lg z-50
      transform transition-all duration-250 ease-in-out
      ${open ? "translate-x-0" : "translate-x-full"}`}
    >
      <FaRegUserCircle size={50} />
      <p className="text-xl font-bold">{user?.nome}</p>

    </div>
  )
}