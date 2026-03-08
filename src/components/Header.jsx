import logo from "../assets/images/logo.png"

import { FaBell, FaRegUserCircle} from "react-icons/fa"

export const Header = ({ username }) => {
  return (
<header className="flex justify-between items-center py-2 fixed w-full px-10 bg-white left-0 top-0">      <div className="flex items-center gap-2">
        <img className="w-25" src={logo} alt="Logo Log Zélia" />
        <p className="font-bold font-montserrat text-4xl text-green-700">LOG <span className="text-orange-500">ZÉLIA</span></p>
      </div>

      <div className="flex gap-5 items-center">
        <FaBell />
        <div className="flex items-center gap-2">
          <p>{username}</p>
          <FaRegUserCircle />
        </div>
      </div>
    </header>
  )
}
