import { useState } from "react"
import { useAuth } from "../hooks/useAuth"
import logo from "../assets/images/logo.png"
import { UserSidebar } from "./UserSidebar"
import { FaBell } from "react-icons/fa"
import { CurrentUserAvatar } from "./CurrentUserAvatar"
import { useCurrentUserName } from "../hooks/useCurrentUserName"

export function Header() {
  const { user } = useAuth()
  const name = useCurrentUserName()
  const [open, setOpen] = useState(false)

  function toggleSidebar() {
    setOpen(!open)
  }

  return (
    <>
      <header className="h-16 flex justify-between items-center fixed w-full px-6 border-b-2 border-gray-300 bg-white top-0 left-0 z-50">

        <div className="flex items-center gap-3">
          <img className="w-12" src={logo} alt="Logo Log Zélia" />
          <p className="font-bold font-montserrat text-2xl text-green-700 leading-none">
            LOG <span className="text-orange-500">ZÉLIA</span>
          </p>
        </div>

        <div className="flex gap-6 items-center">
          <FaBell className="text-xl" />

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={toggleSidebar}
          >
            <p className="text-base">
              {user?.nome || name || "Usuário"}
            </p>
            <CurrentUserAvatar />
          </div>
        </div>

      </header>

      <UserSidebar open={open} setOpen={setOpen} />
    </>
  )
}