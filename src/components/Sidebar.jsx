import { SidebarOptions as So } from './SidebarOptions'
import { FaHome, FaExclamationCircle, FaPaste, FaCog } from 'react-icons/fa'

export const Sidebar = ({ open, setOpen }) => {

  const handleClick = () => {
    if (window.innerWidth < 768) {
      setOpen(false)
    }
  }

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 bg-black/50 z-990 md:hidden ${
          open ? "block" : "hidden"
        }`}
      />

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r-2 border-gray-300 p-6 gap-5 flex flex-col z-1000
          transform transition-transform duration-300

          ${open ? "translate-x-0" : "-translate-x-full"}

          md:translate-x-0 md:top-16 md:h-[calc(100vh-4rem)]
        `}
      >
        <div className="md:hidden mb-4">
          <h1 className="text-lg font-bold">Menu</h1>
        </div>

        <So to="/" icon={FaHome} text="Início" onClick={handleClick} />
        <So to="/advertencias" icon={FaExclamationCircle} text="Advertências" onClick={handleClick} />
        <So to="/gestao" icon={FaPaste} text="Gestão" onClick={handleClick} />

        <div className="mt-auto">
          <So to="/configuracoes" icon={FaCog} text="Configurações" onClick={handleClick} />
        </div>
      </aside>
    </>
  )
}