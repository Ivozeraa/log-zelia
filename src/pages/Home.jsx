import { useEffect, useRef, useState } from 'react'
import { FaExclamationTriangle } from 'react-icons/fa'
import { supabase } from '../utils/supabase'
import { useAuth } from "../hooks/useAuth"
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { notify } from '../utils/notify'

export const Home = () => {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [escolas, setEscolas] = useState([])
  const [selectedEscola, setSelectedEscola] = useState('')
  const [turmas, setTurmas] = useState([])
  const [alunos, setAlunos] = useState([])
  const [selectedTurma, setSelectedTurma] = useState('')
  const [selectedAluno, setSelectedAluno] = useState('')
  const [loadingEscolas, setLoadingEscolas] = useState(false)
  const [loadingTurmas, setLoadingTurmas] = useState(false)
  const [loadingAlunos, setLoadingAlunos] = useState(false)
  const [turmaOpen, setTurmaOpen] = useState(false)
  const [alunoOpen, setAlunoOpen] = useState(false)
  const [alunoSearch, setAlunoSearch] = useState('')
  const [dataOcorrido, setDataOcorrido] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataTermino, setDataTermino] = useState('')
  const [tipoAdvertencia, setTipoAdvertencia] = useState('')
  const [tipoSituacao, setTipoSituacao] = useState('')
  const [descricao, setDescricao] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState('')
  const modalRef = useRef(null)
  const alunosFiltrados = alunos.filter((aluno) =>
    aluno.nome.toLowerCase().includes(alunoSearch.toLowerCase())
  )

  const selectedTurmaObj = turmas.find((turma) => turma.id === selectedTurma)
  const selectedAlunoObj = alunos.find((aluno) => aluno.id === selectedAluno)

  const resetForm = () => {
    setSelectedTurma('')
    setSelectedAluno('')
    setAlunoSearch('')
    setDataOcorrido('')
    setDataInicio('')
    setDataTermino('')
    setTipoAdvertencia('')
    setTipoSituacao('')
    setDescricao('')
    setFormMessage('')
  }

  useEffect(() => {
    const loadEscolas = async () => {
      if (!user) return

      console.log('user:', user)

      let query = supabase.from('escolas').select('id, nome')

      if (Number(user.role_id) === 1) {
        const { data, error } = await query

        if (error) {
          notify.error("Erro carregando as escolas")
          console.error('Erro carregando escolas:', error)
          setEscolas([])
          return
        }

        console.log('escolas carregadas:', data)

        setEscolas(data || [])

        if (data && data.length > 0) {
          setSelectedEscola(data[0].id)
        }
      }
      // USUÁRIO NORMAL → só a escola dele
      else if (user.escola_id) {
        const { data, error } = await query
          .eq('id', user.escola_id)
          .single()

        if (error) {
          notify.error("Erro carregando as escolas")
          console.error('Erro carregando escola:', error)
          setEscolas([])
          return
        }

        console.log('escola do usuário:', data)

        setEscolas([data])
        setSelectedEscola(data?.id || '')
      }
    }

    loadEscolas()
  }, [user])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!user?.id) {
      setFormMessage('Erro: usuário não autenticado.')
      return
    }

    if (!selectedEscola || !selectedTurma || !selectedAluno || !dataOcorrido || !dataInicio || !dataTermino || !tipoAdvertencia || !tipoSituacao || !descricao) {
      notify.warning("Preencha todos os campos antes de registrar a ocorrência.")
      setFormMessage('Preencha todos os campos antes de registrar a ocorrência.')
      return
    }

    setSubmitting(true)
    setFormMessage('')

    const payload = {
      escola_id: selectedEscola,
      aluno_id: selectedAluno,
      professor_id: user.id,
      turma_id: selectedTurma,
      data_ocorrido: dataOcorrido,
      data_inicio: dataInicio,
      data_fim: dataTermino,
      tipo: tipoSituacao,
      categoria: tipoAdvertencia,
      descricao: descricao,
    }

    console.log('user', user)
    console.log('turma', selectedTurmaObj)
    console.log('payload ocorrencia', payload)
    const { error } = await supabase.from('ocorrencias').insert(payload)

    if (error) {
      console.error('Erro ao registrar ocorrência:', error)
      setSubmitting(false)
      setFormMessage('Ocorreu um erro ao registrar. Tente novamente.')
      notify.error('Erro ao registrar ocorrência')
      return
    }

    const statusMap = {
      ocorrencia: 'normal',
      suspensao: 'suspenso',
    }

    const { error: updateError } = await supabase
      .from('alunos')
      .update({ status: statusMap[tipoAdvertencia] ?? 'normal' })
      .eq('id', selectedAluno)

    setSubmitting(false)

    if (updateError) {
      console.error('Erro ao atualizar status do aluno:', updateError)
      setFormMessage('Ocorrência registrada, mas não foi possível atualizar o status do aluno.')
      notify.error('Erro ao atualizar status do aluno') 
      return
    }

    setFormMessage('Ocorrência registrada com sucesso!')
    notify.success("Ocorrência registrada com sucesso!")
    resetForm()
    setOpen(false)
  }

  useEffect(() => {
    const loadTurmas = async () => {
      if (!selectedEscola) {
        setTurmas([])
        setSelectedTurma('')
        return
      }

      setLoadingTurmas(true)
      const { data: turmasData, error: turmasError } = await supabase
        .from('turmas')
        .select('id, nome, escola_id')
        .eq('escola_id', selectedEscola)
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
  }, [selectedEscola])

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
          className='flex  gap-2 items-center justify-center bg-red-900 p-2 rounded-xl cursor-pointer'
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
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" ref={modalRef} onSubmit={handleSubmit}>
          {formMessage && (
            <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {formMessage}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Escola</label>
            <select
              value={selectedEscola}
              onChange={(event) => {
                setSelectedEscola(event.target.value)
                setSelectedTurma('')
                setSelectedAluno('')
              }}
              className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Selecionar escola</option>
              {escolas.map((escola) => (
                <option key={escola.id} value={escola.id}>
                  {escola.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Turma</label>
            <button
              type="button"
              onClick={() => {
                setTurmaOpen((prev) => !prev)
                setAlunoOpen(false)
              }}
              disabled={!selectedEscola || loadingTurmas}
              className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
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
              className="flex w-full h-12 items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-3 text-left text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                {selectedAlunoObj
                  ? `${selectedAlunoObj.nome} - ${selectedAlunoObj.matricula || 'sem matrícula'}`
                  : 'Selecionar aluno'}
              </span>
              <span className="text-slate-500 ml-2 shrink-0">▾</span>
            </button>

            {alunoOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
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
            <label className="text-sm font-semibold text-slate-700">Tipo de advertência</label>
            <select
              value={tipoAdvertencia}
              onChange={(event) => setTipoAdvertencia(event.target.value)}
              className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Selecionar tipo</option>
              <option value="ocorrencia">Ocorrência</option>
              <option value="suspensao">Suspensão</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Data da ocorrência</label>
            <input
              type="date"
              value={dataOcorrido}
              onChange={(event) => setDataOcorrido(event.target.value)}
              className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Data de início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
              className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Data de término</label>
            <input
              type="date"
              value={dataTermino}
              onChange={(event) => setDataTermino(event.target.value)}
              className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Tipo de situação</label>
            <select
              value={tipoSituacao}
              onChange={(event) => setTipoSituacao(event.target.value)}
              className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
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
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              className="h-36 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end sm:items-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-red-600 px-4 py-3 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400 sm:w-auto"
            >
              {submitting ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}