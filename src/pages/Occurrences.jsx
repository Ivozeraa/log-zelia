import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'

export const Occurrences = () => {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [selectedTurma, setSelectedTurma] = useState('')
  const [turmas, setTurmas] = useState([])
  const [alunos, setAlunos] = useState([])
  const [occurrences, setOccurrences] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const alunosMap = useMemo(
    () => Object.fromEntries(alunos.map((aluno) => [aluno.id, aluno])),
    [alunos]
  )

  const alunoSummary = useMemo(() => {
    return occurrences.reduce((acc, occurrence) => {
      const existing = acc[occurrence.aluno_id] || { count: 0, latest: null }
      const currentDate = occurrence.data_ocorrido || ''
      const latestDate = existing.latest?.data_ocorrido || ''
      const latest = !existing.latest || currentDate > latestDate ? occurrence : existing.latest

      acc[occurrence.aluno_id] = {
        count: existing.count + 1,
        latest,
      }
      return acc
    }, {})
  }, [occurrences])

  const filteredAlunos = useMemo(() => {
    return alunos.filter((aluno) => {
      const matchesName = search
        ? aluno.nome.toLowerCase().includes(search.toLowerCase())
        : true
      const matchesTurma = selectedTurma ? aluno.turma_id === selectedTurma : true
      return matchesName && matchesTurma
    })
  }, [alunos, search, selectedTurma])

  useEffect(() => {
    const loadData = async () => {
      if (!user) return
      setLoading(true)
      setError('')

      try {
        const turmaQuery = supabase.from('turmas').select('id, nome')
        const alunoQuery = supabase
          .from('alunos')
          .select('id, nome, status, turma_id')
        const occurrenceQuery = supabase
          .from('ocorrencias')
          .select('*')
          .order('data_ocorrido', { ascending: false })

        if (user.role_id !== 1 && user.escola_id) {
          turmaQuery.eq('escola_id', user.escola_id)
          alunoQuery.eq('escola_id', user.escola_id)
          occurrenceQuery.eq('escola_id', user.escola_id)
        }

        const [turmaResult, alunoResult, occurrenceResult] = await Promise.all([
          turmaQuery,
          alunoQuery,
          occurrenceQuery,
        ])

        if (turmaResult.error) throw turmaResult.error
        if (alunoResult.error) throw alunoResult.error
        if (occurrenceResult.error) {
          console.error('Erro na query de ocorrências:', occurrenceResult.error)
          throw occurrenceResult.error
        }

        setTurmas(turmaResult.data || [])
        setAlunos(alunoResult.data || [])
        setOccurrences(occurrenceResult.data || [])
      } catch (err) {
        console.error('Erro carregando ocorrências:', err)
        setError('Não foi possível carregar as ocorrências. Recarregue a página.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Ocorrências</h1>
            <p className="text-sm text-slate-500">
              Pesquise por aluno e filtre por turma. Veja o status e o total de ocorrências de cada aluno.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 sm:w-auto">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Buscar aluno</label>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome do aluno"
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Filtrar turma</label>
              <select
                value={selectedTurma}
                onChange={(event) => setSelectedTurma(event.target.value)}
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Todas as turmas</option>
                {turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>
                    {turma.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Alunos exibidos</p>
            <p className="text-2xl font-bold text-slate-900">{filteredAlunos.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Alunos com ocorrência</p>
            <p className="text-2xl font-bold text-slate-900">
              {Object.keys(alunoSummary).length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Turmas</p>
            <p className="text-2xl font-bold text-slate-900">{turmas.length}</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Aluno</th>
              <th className="border-b border-slate-200 px-4 py-3">Status</th>
              <th className="border-b border-slate-200 px-4 py-3">Turma</th>
              <th className="border-b border-slate-200 px-4 py-3">Categoria</th>
              <th className="border-b border-slate-200 px-4 py-3">Tipo</th>
              <th className="border-b border-slate-200 px-4 py-3">Data</th>
              <th className="border-b border-slate-200 px-4 py-3">Total</th>
              <th className="border-b border-slate-200 px-4 py-3">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Carregando ocorrências...
                </td>
              </tr>
            ) : filteredAlunos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            ) : (
              filteredAlunos.map((aluno) => {
                const turma = turmas.find((t) => t.id === aluno.turma_id)
                const summary = alunoSummary[aluno.id] || { count: 0, latest: null }
                const latest = summary.latest
                const status = aluno.status?.toLowerCase() || 'normal'
                const rowClass =
                  status === 'normal'
                    ? ''
                    : status.includes('suspenso')
                    ? 'bg-amber-50'
                    : status.includes('expulso')
                    ? 'bg-red-50'
                    : 'bg-slate-50'

                return (
                  <tr key={aluno.id} className={`${rowClass} border-b border-slate-200 last:border-none`}>
                    <td className="px-4 py-4 font-medium text-slate-900">{aluno.nome}</td>
                    <td className="px-4 py-4 text-slate-700 capitalize">{aluno.status || 'normal'}</td>
                    <td className="px-4 py-4 text-slate-700">{turma?.nome || '—'}</td>
                    <td className="px-4 py-4 text-slate-700">
                      {latest?.categoria || '—'}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {latest?.tipo || '—'}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {latest?.data_ocorrido || '—'}
                    </td>
                    <td className="px-4 py-4 text-slate-700">{summary.count}</td>
                    <td className="px-4 py-4 text-slate-700 max-w-[320px] truncate">
                      {latest?.descricao || '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
