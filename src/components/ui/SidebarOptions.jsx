import { NavLink } from "react-router-dom"

export const SidebarOptions = ({ to, icon, text, onClick }) => {
  const IconComponent = icon

  return (
    <NavLink to={to} onClick={onClick}>
      {({ isActive }) => (
        <div
          className={`relative flex items-center gap-2 p-2 cursor-pointer group ${isActive
            ? "bg-green-700 dark:bg-green-800 text-white rounded-xl"
            : "text-gray-700 hover:text-green-800 dark:text-slate-400 dark:hover:text-green-700 rounded-xl"
            }`}
        >
          <IconComponent />
          <p>{text}</p>

          <span
            className={`absolute left-0 bottom-0 h-0.5 w-full bg-green-700 dark:bg-green-800 origin-left ${isActive
              ? "scale-x-0"
              : "scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
              }`}
          ></span>
        </div>
      )}
    </NavLink>
  )
}