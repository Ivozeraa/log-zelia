import { useEffect, useState } from 'react'
import { FaExclamationTriangle } from 'react-icons/fa'
import { supabase } from '../utils/supabase'
import { useAuth } from "../hooks/useAuth"
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'

export const Home = () => {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [turmas, setTurmas] = useState([])
  const [alunos, setAlunos] = useState([])
  const [selectedTurma, setSelectedTurma] = useState('')
  const [selectedAluno, setSelectedAluno] = useState('')
  const [loadingTurmas, setLoadingTurmas] = useState(false)
  const [loadingAlunos, setLoadingAlunos] = useState(false)
  const alunosFiltrados = alunos

  useEffect(() => {
    const loadTurmas = async () => {
      // Se é admin (role_id === 1), carrega todas as turmas
      if (user?.role_id === 1) {
        console.log('Usuário é admin, carregando todas as turmas...')
        const { data: allTurmas, error: allError } = await supabase
          .from('turmas')
          .select('id, nome')
          .order('nome', { ascending: true })

        if (allError) {
          console.error('Erro carregando todas as turmas:', allError)
          setTurmas([])
        } else {
          setTurmas(allTurmas || [])
        }
        setLoadingTurmas(false)
        return
      }

      // Se não é admin, verifica se tem escola_id
      if (!user?.escola_id) {
        console.log('Usuário não é admin e não tem escola_id')
        setTurmas([])
        setLoadingTurmas(false)
        return
      }

      // Carrega turmas da escola do usuário
      setLoadingTurmas(true)
      const { data: turmasData, error: turmasError } = await supabase
        .from('turmas')
        .select('id, nome')
        .eq('escola_id', user.escola_id)
        .order('nome', { ascending: true })

      if (turmasError) {
        console.error('Erro carregando turmas:', turmasError)
        setTurmas([])
      } else {
        setTurmas(turmasData || [])
      }
      setLoadingTurmas(false)
    }

    loadTurmas()
  }, [user?.escola_id, user?.role_id])

  useEffect(() => {
    const loadAlunos = async () => {
      if (!selectedTurma) {
        setAlunos([])
        setSelectedAluno('')
        return
      }

      setLoadingAlunos(true)
      const { data: alunosData, error: alunosError } = await supabase
        .from('alunos')
        .select('id, nome')
        .eq('turma_id', selectedTurma)
        .order('nome', { ascending: true })

      if (alunosError) {
        console.error('Erro carregando alunos:', alunosError)
        setAlunos([])
      } else {
        setAlunos(alunosData || [])
      }
      setLoadingAlunos(false)
    }

    loadAlunos()
  }, [selectedTurma])

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

          <select
            value={selectedTurma}
            onChange={(event) => setSelectedTurma(event.target.value)}
            className="p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Turma</option>
            {loadingTurmas ? (
              <option value="" disabled>Carregando turmas...</option>
            ) : turmas.length > 0 ? (
              turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome}
                </option>
              ))
            ) : (
              <option value="" disabled>Nenhuma turma encontrada</option>
            )}
          </select>

          <select
            value={selectedAluno}
            onChange={(event) => setSelectedAluno(event.target.value)}
            disabled={!selectedTurma || loadingAlunos}
            className="p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <option value="">Aluno</option>
            {selectedTurma ? (
              loadingAlunos ? (
                <option value="" disabled>Carregando alunos...</option>
              ) : alunosFiltrados.length > 0 ? (
                alunosFiltrados.map((aluno) => (
                  <option key={aluno.id} value={aluno.id}>
                    {aluno.nome}
                  </option>
                ))
              ) : (
                <option value="" disabled>Nenhum aluno nesta turma</option>
              )
            ) : (
              <option value="" disabled>Selecione uma turma primeiro</option>
            )}
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