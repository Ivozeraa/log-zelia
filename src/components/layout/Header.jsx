import { useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import logo from "../../assets/images/logo.png"
import { UserSidebar } from "../user/UserSidebar"
import { Sidebar } from "./Sidebar"
import { FaBell, FaBars } from "react-icons/fa"
import { CurrentUserAvatar } from "../user/CurrentUserAvatar"
import { useCurrentUserName } from "../../hooks/useCurrentUserName"

export function Header() {
  const { user } = useAuth()
  const name = useCurrentUserName()

  const [openUser, setOpenUser] = useState(false)
  const [openMenu, setOpenMenu] = useState(false)

  function toggleUserSidebar() {
    setOpenUser(!openUser)
  }

  function toggleMenu() {
    setOpenMenu(!openMenu)
  }

  return (
    <>
      <header className="h-16 flex justify-between items-center fixed w-full px-6 border-b-2 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 z-50">

        <div className="flex items-center gap-3">

          <button
            onClick={toggleMenu}
            className="md:hidden text-xl cursor-pointer dark:text-white"
          >
            <FaBars />
          </button>

          <img className="w-12" src={logo} alt="Logo Log Zélia" />

          <p className="font-bold font-montserrat text-2xl text-green-700 leading-none">
            LOG <span className="text-orange-500 dark:text-orange-600">ZÉLIA</span>
          </p>
        </div>

        <div className="flex gap-6 items-center">
          <FaBell className="text-xl dark:text-white" />

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={toggleUserSidebar}
          >
            <p className="hidden sm:block text-base dark:text-white">
              {user?.nome || name || "Usuário"}
            </p>
            <CurrentUserAvatar />
          </div>
        </div>

      </header>

      <UserSidebar open={openUser} setOpen={setOpenUser} />

      <Sidebar open={openMenu} setOpen={setOpenMenu} />
    </>
  )
}