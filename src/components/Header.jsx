import { useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import logo from "../assets/images/logo.png"
import { UserSidebar } from "./UserSidebar"
import { FaBell, FaRegUserCircle } from "react-icons/fa"

export const Header = () => {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  function toggleSidebar() {
    setOpen(!open)
  }

  return (
    <>
      <header className="flex justify-between items-center py-2 fixed w-full px-10 border-b-2 border-gray-300 bg-white left-0 top-0 z-20">

        <div className="flex items-center gap-2">
          <img className="w-25" src={logo} alt="Logo Log Zélia" />
          <p className="font-bold font-montserrat text-4xl text-green-700">
            LOG <span className="text-orange-500">ZÉLIA</span>
          </p>
        </div>

        <div className="flex gap-10 items-center">
          <FaBell size={25} />

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={toggleSidebar}
          >
            <p>{user?.nome}</p>
            <FaRegUserCircle size={30} />
          </div>
        </div>

      </header>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleSidebar}
        ></div>
      )}

      <UserSidebar open={open} />
    </>
  )
}