import { NavLink } from 'react-router-dom'

import { SidebarOptions as So } from './SidebarOptions'

// Ícones
import { FaHome, FaExclamationCircle, FaPaste, FaCog } from 'react-icons/fa'

export const Sidebar = () => {
  return (
    <aside className='flex flex-col gap-5 fixed bg-white'>
      <So to="/" icon={FaHome} text="Início" />
      <So to="/advertencias" icon={FaExclamationCircle} text="Advertências" />
      <So to="/gestao" icon={FaPaste} text="Gestão" />
      <So to="/configuracoes" icon={FaCog} text="Configurações" />
    </aside>
  )
}
