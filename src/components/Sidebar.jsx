import { SidebarOptions as So } from './SidebarOptions'

// Ícones
import { FaHome, FaExclamationCircle, FaPaste, FaCog } from 'react-icons/fa'

export const Sidebar = () => {
  return (
    <aside className='flex flex-col px-10 pt-10 gap-5 fixed bg-white border-r-2 border-gray-300 h-full w-75'>
      <So to="/" icon={FaHome} text="Início" />
      <So to="/advertencias" icon={FaExclamationCircle} text="Advertências" />
      <So to="/gestao" icon={FaPaste} text="Gestão" />

      <div className="mt-[55vh]">
        <So to="/configuracoes" icon={FaCog} text="Configurações" />
      </div>
    </aside>
  )
}
