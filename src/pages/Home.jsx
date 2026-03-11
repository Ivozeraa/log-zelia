import { FaExclamationTriangle } from 'react-icons/fa'

import { Card } from '../components/Card'

export const Home = ({ username }) => {
  return (
    <div className='flex flex-col gap-10'>
      <p className='text-3xl'>Bem vindo(a), <span className='text-green-700'>{username}</span>!</p>

      <div>
        <span className='flex gap-2 items-center justify-center bg-red-900 p-2 rounded-xl cursor-pointer'>
          <FaExclamationTriangle size={20} className='text-white'/>
          <p className='text-white '>Adicionar Advertência</p>
        </span>
      </div>

      <div>
        <Card />
      </div>
    </div>
  )
}
