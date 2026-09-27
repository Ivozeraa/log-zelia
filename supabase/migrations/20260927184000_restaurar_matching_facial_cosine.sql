create or replace function public.identificar_aluno_frequencia(p_descritor double precision[])
returns table(aluno_id uuid, nome text, similaridade double precision)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_escola_id uuid;
  v_dim integer;
  v_limiar constant double precision := 0.72;
  v_margem_minima constant double precision := 0.05;
  v_top1_id uuid;
  v_top1_nome text;
  v_top1_sim double precision;
  v_top2_sim double precision;
begin
  if not (select private.current_user_is_global_admin())
     and (select private.current_user_role_id()) not in (1, 2, 3) then
    raise exception 'Sem permissão para identificação facial';
  end if;

  v_escola_id := (select private.current_user_school_id());

  if v_escola_id is null then
    raise exception 'Usuário sem escola associada';
  end if;

  if p_descritor is null or array_length(p_descritor, 1) is null then
    raise exception 'Descritor facial inválido';
  end if;

  v_dim := array_length(p_descritor, 1);

  with ranked as (
    select b.aluno_id as ranked_aluno_id, a.nome as ranked_nome,
      private.cosine_similarity(b.descritor, p_descritor) as ranked_sim
    from public.alunos_biometria_facial b
    join public.alunos a on a.id = b.aluno_id
    where b.escola_id = v_escola_id and b.dimensao = v_dim
  ), ordenado as (
    select r.*, row_number() over (order by r.ranked_sim desc nulls last) as ranked_position
    from ranked r
  )
  select o.ranked_aluno_id, o.ranked_nome, o.ranked_sim
  into v_top1_id, v_top1_nome, v_top1_sim
  from ordenado o where o.ranked_position = 1;

  with ranked as (
    select private.cosine_similarity(b.descritor, p_descritor) as ranked_sim
    from public.alunos_biometria_facial b
    where b.escola_id = v_escola_id and b.dimensao = v_dim
  ), ordenado as (
    select r.ranked_sim, row_number() over (order by r.ranked_sim desc nulls last) as ranked_position
    from ranked r
  )
  select o.ranked_sim into v_top2_sim
  from ordenado o where o.ranked_position = 2;

  if v_top1_id is null or v_top1_sim is null or v_top1_sim < v_limiar then return; end if;
  if v_top2_sim is not null and (v_top1_sim - v_top2_sim) < v_margem_minima then return; end if;

  return query select v_top1_id, v_top1_nome, v_top1_sim;
end;
$function$;

revoke execute on function public.identificar_aluno_frequencia(double precision[]) from public, anon;
grant execute on function public.identificar_aluno_frequencia(double precision[]) to authenticated;