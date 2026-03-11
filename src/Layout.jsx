import { Outlet } from 'react-router-dom'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'

function Layout() {
  return (
    <div className='text-2xl font-inter '>
      <Header username={"Usuário"} />
      <div className='flex pt-25'>
        <Sidebar />
        <div className="ml-85 pt-10 pr-10"><Outlet /></div>
      </div>
    </div>
  )
}

export default Layout