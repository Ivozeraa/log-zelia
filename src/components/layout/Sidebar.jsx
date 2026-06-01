import { SidebarOptions as So } from '../ui/SidebarOptions'
import { FaHome, FaExclamationCircle, FaPaste, FaCog } from 'react-icons/fa'
import { useAuth } from '../../hooks/useAuth'

import { SectionTitle } from '../ui/SectionTitle'

export const Sidebar = ({ open, setOpen }) => {
  const { user } = useAuth()

  const handleClick = () => {
    if (window.innerWidth < 768) {
      setOpen(false)
    }
  }

  const canSeeManagement = [1, 2, 3].includes(user?.role_id)

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 bg-black/50 z-990 md:hidden ${open ? "block" : "hidden"
          }`}
      />

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-950 border-r-2 border-gray-300 dark:border-slate-700 p-6 gap-5 flex flex-col z-1000
          transform transition-transform duration-300

          ${open ? "translate-x-0" : "-translate-x-full"}

          md:translate-x-0 md:top-16 md:h-[calc(100vh-4rem)]
        `}
      >
        <div className="md:hidden">
          <SectionTitle text="Menu" />
        </div>

        <So to="/" icon={FaHome} text="Início" onClick={handleClick} />
        <So to="/advertencias" icon={FaExclamationCircle} text="Advertências" onClick={handleClick} />

        {canSeeManagement && (
          <So to="/gestao" icon={FaPaste} text="Gestão" onClick={handleClick} />
        )}

        <div className="mt-auto">
          <So to="/configuracoes" icon={FaCog} text="Configurações" onClick={handleClick} />
        </div>
      </aside>
    </>
  )
}