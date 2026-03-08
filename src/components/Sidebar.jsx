import { NavLink } from 'react-router-dom'

// Ícones
import { FaHome, FaExclamationCircle, FaPaste, FaCog } from 'react-icons/fa'

export const Sidebar = () => {
  return (
    <aside className='flex flex-col gap-5 fixed'>
      <NavLink to="/"className='flex items-center gap-2 cursor-pointer'>
        <FaHome />
        <p>Início</p>
      </NavLink>

      <NavLink to="/advertencias" className='flex items-center gap-2 cursor-pointer'>
        <FaExclamationCircle />
        <p>Advertências</p>
      </NavLink>

      <NavLink to="/gestao" className='flex items-center gap-2 cursor-pointer'>
        <FaPaste />
        <p>Gestão</p>
      </NavLink>

      <NavLink to="/configuracoes" className='flex items-center  gap-2 cursor-pointer'>
        <FaCog />
        <p>Configurações</p>
      </NavLink>
    </aside>
  )
}
