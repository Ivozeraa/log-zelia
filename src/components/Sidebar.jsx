import { SidebarOptions as So } from './SidebarOptions'
import { FaHome, FaExclamationCircle, FaPaste, FaCog } from 'react-icons/fa'

export const Sidebar = () => {
  return (
    <aside className="flex flex-col h-full w-64 bg-white border-r-2 border-gray-300 p-6 gap-5">

      <So to="/" icon={FaHome} text="Início" />
      <So to="/advertencias" icon={FaExclamationCircle} text="Advertências" />
      <So to="/gestao" icon={FaPaste} text="Gestão" />

      <div className="mt-auto">
        <So to="/configuracoes" icon={FaCog} text="Configurações" />
      </div>

    </aside>
  )
}