import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FaCalendarAlt, FaChevronRight, FaClock, FaTimes } from 'react-icons/fa';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';

const WEEK_DAYS = [{ value: 1, label: 'Segunda-feira', short: 'Seg' }, { value: 2, label: 'Terça-feira', short: 'Ter' }, { value: 3, label: 'Quarta-feira', short: 'Qua' }, { value: 4, label: 'Quinta-feira', short: 'Qui' }, { value: 5, label: 'Sexta-feira', short: 'Sex' }];
const SLOT_TIMES = { 1: '7h20', 2: '8h10', 3: '9h30', 4: '10h20', 5: '11h10', 6: '13h00', 7: '13h50', 8: '15h00', 9: '15h50' };
const formatToday = () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());

export const TeacherSchedule = () => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOpen, setWeekOpen] = useState(false);
  const [mountNode, setMountNode] = useState(null);
  const mountNodeRef = useRef(null);
  const today = new Date().getDay();
  const todayValue = today >= 1 && today <= 5 ? today : 1;

  useEffect(() => {
    let active = true;
    const loadSchedule = async () => {
      if (!user?.id || !user?.escola_id) { if (active) setLoading(false); return; }
      setLoading(true);
      try {
        const { data: configs, error: configError } = await supabase.from('horario_configuracoes').select('id, ano_letivo, semestre, created_at').eq('escola_id', user.escola_id).order('ano_letivo', { ascending: false }).order('semestre', { ascending: false }).order('created_at', { ascending: false });
        if (configError) throw configError;
        const currentConfig = configs?.[0];
        if (!currentConfig) { if (active) setLessons([]); return; }
        const { data: professors, error: professorError } = await supabase.from('horario_professores').select('id, usuario_id').eq('configuracao_id', currentConfig.id).eq('usuario_id', user.id);
        if (professorError) throw professorError;
        const professorIds = (professors || []).map((row) => row.id);
        if (!professorIds.length) { if (active) setLessons([]); return; }
        const { data: gradeRows, error: gradeError } = await supabase.from('horario_grade_gerada').select('id, config_turma_id, dia_semana, aula_numero, professor_id, disciplina_id, tipo').eq('configuracao_id', currentConfig.id).in('professor_id', professorIds).order('dia_semana').order('aula_numero');
        if (gradeError) throw gradeError;
        const configTurmaIds = [...new Set((gradeRows || []).map((row) => row.config_turma_id).filter(Boolean))];
        const disciplineIds = [...new Set((gradeRows || []).map((row) => row.disciplina_id).filter(Boolean))];
        const [configTurmasResult, disciplinesResult] = await Promise.all([
          configTurmaIds.length ? supabase.from('horario_config_turmas').select('id, turma_id').in('id', configTurmaIds) : Promise.resolve({ data: [], error: null }),
          disciplineIds.length ? supabase.from('horario_disciplinas').select('id, nome').in('id', disciplineIds) : Promise.resolve({ data: [], error: null }),
        ]);
        if (configTurmasResult.error) throw configTurmasResult.error;
        if (disciplinesResult.error) throw disciplinesResult.error;
        const turmaIds = [...new Set((configTurmasResult.data || []).map((row) => row.turma_id).filter(Boolean))];
        const { data: turmaRows, error: turmaError } = turmaIds.length ? await supabase.from('turmas').select('id, nome').in('id', turmaIds) : { data: [], error: null };
        if (turmaError) throw turmaError;
        const configTurmaMap = Object.fromEntries((configTurmasResult.data || []).map((row) => [String(row.id), row.turma_id]));
        const turmaMap = Object.fromEntries((turmaRows || []).map((row) => [String(row.id), row.nome]));
        const disciplineMap = Object.fromEntries((disciplinesResult.data || []).map((row) => [String(row.id), row.nome]));
        const normalized = (gradeRows || []).map((row) => ({ id: row.id, day: Number(row.dia_semana), slot: Number(row.aula_numero), time: SLOT_TIMES[Number(row.aula_numero)] || `${row.aula_numero}ª aula`, turma: turmaMap[String(configTurmaMap[String(row.config_turma_id)])] || 'Turma', disciplina: row.tipo === 'fc' ? 'Formação para a Cidadania' : disciplineMap[String(row.disciplina_id)] || 'Disciplina' }));
        if (active) setLessons(normalized);
      } catch (error) { console.error('Erro ao carregar horário do professor:', error); if (active) setLessons([]); }
      finally { if (active) setLoading(false); }
    };
    void loadSchedule();
    return () => { active = false; };
  }, [user?.id, user?.escola_id]);

  useEffect(() => {
    let observer;
    let disposed = false;

    const placeSchedule = () => {
      if (disposed || mountNodeRef.current) return true;

      const heading = Array.from(document.querySelectorAll('h2')).find((element) => element.textContent?.trim() === 'Fluxo de Ocorrências');
      const flowCard = heading?.closest('div.w-full');
      if (!flowCard?.parentNode) return false;

      const slot = document.createElement('div');
      slot.setAttribute('data-teacher-schedule-slot', 'true');
      flowCard.parentNode.insertBefore(slot, flowCard);
      mountNodeRef.current = slot;
      setMountNode(slot);
      return true;
    };

    if (!placeSchedule()) {
      observer = new MutationObserver(() => {
        if (placeSchedule()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      mountNodeRef.current?.remove();
      mountNodeRef.current = null;
      setMountNode(null);
    };
  }, []);

  const todayLessons = useMemo(() => lessons.filter((lesson) => lesson.day === todayValue).sort((a, b) => a.slot - b.slot), [lessons, todayValue]);
  const weekGroups = useMemo(() => WEEK_DAYS.map((day) => ({ ...day, lessons: lessons.filter((lesson) => lesson.day === day.value).sort((a, b) => a.slot - b.slot) })), [lessons]);

  const scheduleContent = <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-green-700 dark:text-green-400"><FaCalendarAlt /> Seu horário</div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Aulas de hoje</h2>
        <p className="mt-1 text-sm capitalize text-slate-500 dark:text-slate-400">{formatToday()}</p>
      </div>
      <button type="button" onClick={() => setWeekOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-green-300 hover:text-green-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">Ver horário completo <FaChevronRight className="text-xs" /></button>
    </div>
    <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
      {loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div> : todayLessons.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{todayLessons.map((lesson) => <article key={lesson.id} className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><div className="min-w-0"><p className="break-words text-base font-extrabold text-slate-900 dark:text-white">{lesson.disciplina}</p><p className="mt-1 break-words text-sm font-medium text-slate-500 dark:text-slate-400">{lesson.turma}</p></div><div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><FaClock /> {lesson.time} · {lesson.slot}ª aula</div></article>)}</div> : <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center dark:bg-slate-950"><p className="font-bold text-slate-700 dark:text-slate-200">Nenhuma aula hoje.</p></div>}
    </div>
  </section>;

  const weekModal = weekOpen && createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[92vh] min-h-0 min-w-0 w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700 dark:text-green-400">Horário semanal</p><h3 className="mt-1 truncate text-xl font-black text-slate-900 dark:text-white">Todas as suas aulas</h3></div>
          <button type="button" onClick={() => setWeekOpen(false)} className="shrink-0 rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"><FaTimes /></button>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {weekGroups.map((day) => <section key={day.value} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"><div className="mb-3 flex min-w-0 items-center justify-between gap-2 px-1"><h4 className="shrink-0 font-extrabold text-slate-900 dark:text-white">{day.short}</h4><span className="min-w-0 truncate text-xs font-bold text-slate-400">{day.lessons.length} aulas</span></div><div className="space-y-2">{day.lessons.length ? day.lessons.map((lesson) => <div key={lesson.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><span className="text-xs font-black text-green-700 dark:text-green-400">{lesson.time}</span><p className="mt-1.5 break-words text-sm font-extrabold text-slate-900 dark:text-white">{lesson.disciplina}</p><p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{lesson.turma}</p></div>) : <p className="px-1 py-4 text-center text-xs text-slate-400">Sem aulas</p>}</div></section>)}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );

  return <>{mountNode ? createPortal(scheduleContent, mountNode) : null}{weekModal}</>;
};

export default TeacherSchedule;
