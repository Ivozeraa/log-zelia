import { useEffect, useRef, useState } from 'react'
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
  const [turmaOpen, setTurmaOpen] = useState(false)
  const [alunoOpen, setAlunoOpen] = useState(false)
  const [alunoSearch, setAlunoSearch] = useState('')
  const modalRef = useRef(null)
  const alunosFiltrados = alunos.filter((aluno) =>
    aluno.nome.toLowerCase().includes(alunoSearch.toLowerCase())
  )

  const selectedTurmaObj = turmas.find((turma) => turma.id === selectedTurma)
  const selectedAlunoObj = alunos.find((aluno) => aluno.id === selectedAluno)

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
        setAlunoSearch('')
        return
      }

      setLoadingAlunos(true)
      const { data: alunosData, error: alunosError } = await supabase
        .from('alunos')
        .select('id, nome, matricula')
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setTurmaOpen(false)
        setAlunoOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" ref={modalRef}>
          <div className="relative flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Turma</label>
            <button
              type="button"
              onClick={() => {
                setTurmaOpen((prev) => !prev)
                setAlunoOpen(false)
              }}
              className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <span>{selectedTurmaObj?.nome || 'Selecionar turma'}</span>
              <span className="text-slate-500">▾</span>
            </button>

            {turmaOpen && (
              <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                {loadingTurmas ? (
                  <div className="px-3 py-3 text-sm text-slate-500">Carregando turmas...</div>
                ) : turmas.length > 0 ? (
                  turmas.map((turma) => (
                    <button
                      key={turma.id}
                      type="button"
                      onClick={() => {
                        setSelectedTurma(turma.id)
                        setSelectedAluno('')
                        setTurmaOpen(false)
                      }}
                      className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                    >
                      {turma.nome}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-slate-500">Nenhuma turma encontrada</div>
                )}
              </div>
            )}
          </div>

          <div className="relative flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Aluno</label>
            <button
              type="button"
              onClick={() => {
                if (!selectedTurma) return
                setAlunoOpen((prev) => !prev)
                setTurmaOpen(false)
              }}
              disabled={!selectedTurma || loadingAlunos}
              className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <span>{selectedAlunoObj ? `${selectedAlunoObj.nome} - ${selectedAlunoObj.matricula || 'sem matrícula'}` : 'Selecionar aluno'}</span>
              <span className="text-slate-500">▾</span>
            </button>

            {alunoOpen && (
              <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-200 px-3 py-2">
                  <input
                    type="text"
                    value={alunoSearch}
                    onChange={(event) => setAlunoSearch(event.target.value)}
                    placeholder="Buscar aluno..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {loadingAlunos ? (
                    <div className="px-3 py-3 text-sm text-slate-500">Carregando alunos...</div>
                  ) : alunosFiltrados.length > 0 ? (
                    alunosFiltrados.map((aluno) => (
                      <button
                        key={aluno.id}
                        type="button"
                        onClick={() => {
                          setSelectedAluno(aluno.id)
                          setAlunoOpen(false)
                        }}
                        className="w-full px-3 py-3 text-left text-slate-900 transition hover:bg-slate-100"
                      >
                        {aluno.nome} - {aluno.matricula || 'sem matrícula'}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-slate-500">Nenhum aluno encontrado</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Data</label>
            <input
              type="date"
              className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Tipo de advertência</label>
            <select className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
              <option value="">Selecionar tipo</option>
              <option value="ocorrencia">Ocorrência</option>
              <option value="Suspenção">Suspenção</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Tipo de situação</label>
            <select className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
              <option value="">Selecionar situação</option>
              <option value="indisciplina">Indisciplina</option>
              <option value="infrequencia">Infrequência</option>
              <option value="atraso">Atraso</option>
              <option value="desrespeito">Desrespeito</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Descrição</label>
            <textarea
              placeholder="Descreva a ocorrência..."
              rows={5}
              className="h-36 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end sm:items-center">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="w-full rounded-xl bg-red-600 px-4 py-3 text-white transition hover:bg-red-700 sm:w-auto"
            >
              Registrar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}