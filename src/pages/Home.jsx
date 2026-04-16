import { useState } from 'react'
import { FaExclamationTriangle } from 'react-icons/fa'
import { useAuth } from "../hooks/useAuth"
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'

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

      <Modal isOpen={open} onClose={() => setOpen(!open)} title="Adicionar Advertência">
        <form className="flex flex-col gap-4">

          <select className="p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Turma</option>
          </select>

          <select className="p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Aluno</option>
          </select> 
          
          <input
            type="date"
            className="p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select className="p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tipo de advertência</option>
            <option value="ocorrencia">Ocorrência</option>
            <option value="Suspenção">Suspenção</option>
          </select>

          <select className="p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tipo de situação</option>
            <option value="indisciplina">Indisciplina</option>
            <option value="infrequencia">Infrequência</option>
            <option value="atraso">Atraso</option>
            <option value="desrespeito">Desrespeito</option>
            <option value="outro">Outro</option>
          </select>

          <textarea
            placeholder="Descreva a ocorrência..."
            rows={4}
            className="p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
            >
              Registrar
            </button>
          </div>

        </form>
      </Modal>
    </div>
  )
}