import { Outlet } from 'react-router-dom'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'

function Layout() {
  return (
    <div className='px-10 text-2xl font-inter '>
      <Header username={"Usuário"} />
      <div className='flex pt-30'>
        <Sidebar />
        <div className="ml-85"><Outlet /></div>
      </div>
    </div>
  )
}

export default Layout