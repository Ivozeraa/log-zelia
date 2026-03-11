import logo from "../assets/images/logo.png"

import { FaBell, FaRegUserCircle } from "react-icons/fa"

export const Header = ({ username }) => {
  return (
    <header className="flex justify-between items-center py-2 fixed w-full px-10 border-b-2 border-gray-300 bg-white left-0 top-0">      <div className="flex items-center gap-2">
      <img className="w-25" src={logo} alt="Logo Log Zélia" />
      <p className="font-bold font-montserrat text-4xl text-green-700">LOG <span className="text-orange-500">ZÉLIA</span></p>
    </div>

      <div className="flex gap-10 items-center">
        <FaBell size={25} />
        <div className="flex items-center gap-2">
          <p>{username}</p>
          <FaRegUserCircle size={30} />
        </div>
      </div>
    </header>
  )
}
