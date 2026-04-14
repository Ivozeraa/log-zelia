import { useState } from 'react'
import { FaExclamationTriangle } from 'react-icons/fa'
import { useAuth } from "../hooks/useAuth"
import { Card } from '../components/Card'
import { DivBackground } from '../components/DivBackground'

export const Home = () => {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <div className='flex flex-col gap-10 w-full'>
      <p className='text-3xl'>
        Bem vindo(a), <span className='text-green-700'>{user?.nome}</span>!
      </p>

      <div>
        <button
          onClick={() => setOpen(!open)}
          className='flex w-1/3 gap-2 items-center justify-center bg-red-900 p-2 rounded-xl cursor-pointer'
        >
          <FaExclamationTriangle size={20} className='text-white' />
          <p className='text-white'>Adicionar Advertência</p>
        </button>
      </div>

      <div className='flex flex-col gap-2'>
        <p className='font-bold'>Dashboard</p>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full'>
          <Card title="Ocorrências" content="180" subtitle="no ano" />
          <Card title="Pendentes" content="45" subtitle="atualmente" />
          <Card title="Resolvidas" content="135" subtitle="no ano" />
        </div>
      </div>

      {open && <DivBackground close={() => setOpen(false)} />}
    </div>
  )
}