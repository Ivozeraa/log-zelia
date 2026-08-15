import { useEffect, useState } from 'react'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../hooks/useAuth'

const MEDALS = ['🥇', '🥈', '🥉']

const RANK_COLORS = [
  {
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-700',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    bar: 'bg-amber-400',
  },
  {
    bg: 'bg-slate-50 dark:bg-slate-900',
    border: 'border-slate-200 dark:border-slate-700',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    bar: 'bg-slate-400',
  },
  {
    bg: 'bg-orange-50 dark:bg-orange-950',
    border: 'border-orange-200 dark:border-orange-700',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    bar: 'bg-orange-400',
  },
]

const YOU_COLOR = {
  bg: 'bg-green-50 dark:bg-green-950',
  border: 'border-green-300 dark:border-green-700',
  badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  bar: 'bg-green-500',
}

const Avatar = ({ nome, avatarUrl, size = 44 }) => {
  const initials = nome
    ? nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const [imageFailed, setImageFailed] = useState(false)

  if (avatarUrl && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        alt={nome}
        onError={() => setImageFailed(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.33,
        fontWeight: 600,
        color: '#475569',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

const TurmaAvatar = ({ label, size = 44 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.28,
      fontWeight: 700,
      color: '#475569',
      flexShrink: 0,
      letterSpacing: '-0.5px',
    }}
  >
    {label}
  </div>
)

const RankingSkeleton = () => (
  <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
    <div className="mb-4 h-5 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  </div>
)

const getAvatarUrl = (userId) => {
  if (!userId) return null
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(`${userId}/avatar.png`)
  return data?.publicUrl || null
}

const RankingProfessores = ({ escolaId, mesLabel, userId, userName }) => {
  const [ranking, setRanking] = useState([])
  const [avatars, setAvatars] = useState({})
  const [myEntry, setMyEntry] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!escolaId) {
        if (active) setLoading(false)
        return
      }
      setLoading(true)

      const hoje = new Date()
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('ocorrencias')
        .select('professor_id, professor_nome')
        .eq('escola_id', escolaId)
        .gte('data_ocorrido', inicioMes)

      if (error) {
        console.error(error)
        if (active) setLoading(false)
        return
      }

      const contagem = {}
      ;(data || []).forEach(({ professor_id, professor_nome }) => {
        if (!professor_id) return
        if (!contagem[professor_id]) {
          contagem[professor_id] = {
            id: professor_id,
            nome: professor_nome || 'Professor',
            total: 0,
          }
        }
        contagem[professor_id].total += 1
      })

      const sorted = Object.values(contagem).sort((a, b) => b.total - a.total)
      const top3 = sorted.slice(0, 3)

      const avatarMap = Object.fromEntries(
        top3.map((professor) => [professor.id, getAvatarUrl(professor.id)]),
      )

      const myPos = sorted.findIndex((p) => p.id === userId)
      const nextMyEntry = myPos !== -1 && myPos >= 3
        ? { ...sorted[myPos], position: myPos + 1 }
        : myPos === -1
          ? { id: userId, nome: userName, total: 0, position: null }
          : null

      if (!active) return
      setRanking(top3)
      setAvatars(avatarMap)
      setMyEntry(nextMyEntry)
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [escolaId, userId, userName])

  const maxTotal = ranking[0]?.total || 1

  if (loading) return <RankingSkeleton />

  if (ranking.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma ocorrência registrada este mês.</p>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
      <div className="mb-6 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Ranking de Professores</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Que mais registraram ocorrências em {mesLabel}</p>
        </div>
        <div className="w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Top 3 do mês</div>
      </div>

      <div className="flex flex-col gap-3">
        {ranking.map((professor, index) => {
          const isYou = professor.id === userId
          const colors = isYou ? YOU_COLOR : RANK_COLORS[index] ?? RANK_COLORS[2]
          const barWidth = Math.round((professor.total / maxTotal) * 100)

          return (
            <div key={professor.id} className={`flex flex-col gap-2 rounded-xl border p-4 transition-all ${colors.bg} ${colors.border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar nome={professor.nome} avatarUrl={avatars[professor.id] ?? null} size={44} />
                  <div>
                    <p className="flex items-center gap-1 text-sm font-semibold text-slate-800 dark:text-white">
                      <span>{MEDALS[index]}</span>
                      <span>{professor.nome}</span>
                      {isYou && (
                        <span className="ml-1 rounded-full bg-green-200 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-800 dark:text-green-100">você</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{index + 1}º lugar</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${colors.badge}`}>{professor.total}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={`h-full rounded-full transition-all duration-500 ${colors.bar}`} style={{ width: `${barWidth}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {myEntry && (
        <div className="mt-4">
          <div className="mb-2 border-t border-dashed border-slate-200 dark:border-slate-700" />
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Sua posição</p>
          <div className={`flex items-center justify-between rounded-xl border p-4 ${YOU_COLOR.bg} ${YOU_COLOR.border}`}>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-200 text-sm font-bold text-green-800 dark:bg-green-800 dark:text-green-100">
                {myEntry.position ?? '—'}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  {myEntry.nome}
                  <span className="ml-2 rounded-full bg-green-200 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-800 dark:text-green-100">você</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {myEntry.position ? `${myEntry.position}º lugar` : 'Sem ocorrências este mês'}
                </p>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${YOU_COLOR.badge}`}>{myEntry.total}</span>
          </div>
        </div>
      )}
    </div>
  )
}

const RankingTurmas = ({ escolaId, mesLabel }) => {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!escolaId) {
        if (active) setLoading(false)
        return
      }
      setLoading(true)

      const hoje = new Date()
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('ocorrencias')
        .select('turma_id, turmas(nome)')
        .eq('escola_id', escolaId)
        .gte('data_ocorrido', inicioMes)

      if (error) {
        console.error(error)
        if (active) setLoading(false)
        return
      }

      const contagem = {}
      ;(data || []).forEach(({ turma_id, turmas }) => {
        if (!turma_id) return
        const nome = turmas?.nome || 'Turma'
        if (!contagem[turma_id]) contagem[turma_id] = { id: turma_id, nome, total: 0 }
        contagem[turma_id].total += 1
      })

      const sorted = Object.values(contagem).sort((a, b) => b.total - a.total)
      if (active) {
        setRanking(sorted.slice(0, 3))
        setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [escolaId])

  const maxTotal = ranking[0]?.total || 1

  const getTurmaLabel = (nome) => {
    const clean = nome.replace(/[ºª°]/g, '').trim()
    const parts = clean.split(/\s+/)
    if (parts.length === 1) return clean.slice(0, 2).toUpperCase()
    return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase()
  }

  if (loading) return <RankingSkeleton />

  if (ranking.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma turma com ocorrências este mês.</p>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
      <div className="mb-6 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Ranking de Turmas</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Turmas com mais registros em {mesLabel}</p>
        </div>
        <div className="w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Top 3 do mês</div>
      </div>

      <div className="flex flex-col gap-3">
        {ranking.map((turma, index) => {
          const colors = RANK_COLORS[index] ?? RANK_COLORS[2]
          const barWidth = Math.round((turma.total / maxTotal) * 100)

          return (
            <div key={turma.id} className={`flex flex-col gap-2 rounded-xl border p-4 transition-all ${colors.bg} ${colors.border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TurmaAvatar label={getTurmaLabel(turma.nome)} size={44} />
                  <div>
                    <p className="flex items-center gap-1 text-sm font-semibold text-slate-800 dark:text-white">
                      <span>{MEDALS[index]}</span>
                      <span>{turma.nome}</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{index + 1}º lugar</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${colors.badge}`}>{turma.total}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={`h-full rounded-full transition-all duration-500 ${colors.bar}`} style={{ width: `${barWidth}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const RankingOcorrencias = ({ escolaId }) => {
  const { user } = useAuth()
  const [mesLabel, setMesLabel] = useState('')

  useEffect(() => {
    const hoje = new Date()
    const nomeMes = hoje.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
    setMesLabel(nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1))
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <RankingProfessores escolaId={escolaId} mesLabel={mesLabel} userId={user?.id} userName={user?.nome} />
      <RankingTurmas escolaId={escolaId} mesLabel={mesLabel} />
    </div>
  )
}
