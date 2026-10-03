create or replace function public.get_frequencia_calendario_aluno(
  p_aluno_id uuid,
  p_data_inicio date,
  p_data_fim date
)
returns table(
  data date,
  entrada timestamptz,
  saida timestamptz,
  status text,
  eh_dia_util boolean
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with aluno_permitido as (
    select a.id, a.turma_id
    from public.alunos a
    where a.id = p_aluno_id
      and a.escola_id = (select private.current_user_school_id())
      and (
        (select private.current_user_role_id()) in (1, 2, 3)
        or exists (
          select 1
          from public.horario_professores hp
          join public.horario_professor_turma hpt on hpt.professor_id = hp.id
          join public.horario_config_turmas hct on hct.id = hpt.config_turma_id
          where hp.usuario_id = (select auth.uid())
            and hct.escola_id = (select private.current_user_school_id())
            and hct.turma_id = a.turma_id
        )
      )
  ),
  dias as (
    select gs::date as data
    from generate_series(
      greatest(p_data_inicio, p_data_fim - 92),
      least(p_data_fim, p_data_inicio + 92),
      interval '1 day'
    ) gs
  ),
  eventos as (
    select
      r.data,
      min(r.registrado_em) filter (where r.tipo = 'entrada' and r.status = 'registrado') as entrada,
      max(r.registrado_em) filter (where r.tipo = 'saida' and r.status = 'registrado') as saida
    from public.registros_acesso r
    join aluno_permitido ap on ap.id = r.aluno_id
    where r.escola_id = (select private.current_user_school_id())
      and r.data between greatest(p_data_inicio, p_data_fim - 92)
                     and least(p_data_fim, p_data_inicio + 92)
    group by r.data
  )
  select
    d.data,
    e.entrada,
    e.saida,
    case
      when d.data > (now() at time zone 'America/Fortaleza')::date then 'futuro'
      when extract(isodow from d.data) > 5 then 'fim_de_semana'
      when e.entrada is not null then 'presente'
      else 'falta'
    end as status,
    extract(isodow from d.data) between 1 and 5 as eh_dia_util
  from dias d
  cross join aluno_permitido ap
  left join eventos e on e.data = d.data
  order by d.data;
$function$;

revoke execute on function public.get_frequencia_calendario_aluno(uuid, date, date) from public, anon;
grant execute on function public.get_frequencia_calendario_aluno(uuid, date, date) to authenticated;
