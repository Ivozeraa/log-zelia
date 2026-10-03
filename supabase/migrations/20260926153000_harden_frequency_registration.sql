begin;

create or replace function public.registrar_acesso_frequencia(
  p_aluno_id uuid,
  p_tipo text,
  p_metodo text default 'manual',
  p_ponto_id uuid default null,
  p_confidence_score numeric default null
)
returns public.registros_acesso
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aluno public.alunos;
  v_config public.frequencia_configuracoes;
  v_ultimo public.registros_acesso;
  v_ponto public.pontos_verificacao;
  v_novo public.registros_acesso;
  v_hora_local time;
begin
  if p_tipo not in ('entrada', 'saida') then raise exception 'Tipo de acesso inválido'; end if;
  if p_metodo not in ('facial', 'manual', 'automatico') then raise exception 'Método de acesso inválido'; end if;
  if p_confidence_score is not null and (p_confidence_score < 0 or p_confidence_score > 1) then raise exception 'Confidence score inválido'; end if;

  select * into v_aluno
  from public.alunos
  where id = p_aluno_id
    and escola_id = (select private.current_user_school_id());

  if not found then raise exception 'Aluno não pertence à escola do usuário'; end if;

  select * into v_config
  from public.frequencia_configuracoes
  where escola_id = v_aluno.escola_id
  limit 1;

  if not found or not v_config.habilitado then raise exception 'Frequência desabilitada para esta escola'; end if;

  if p_ponto_id is not null then
    select * into v_ponto
    from public.pontos_verificacao
    where id = p_ponto_id
      and escola_id = v_aluno.escola_id
      and ativo = true;

    if not found then raise exception 'Ponto de verificação inválido para esta escola'; end if;
  end if;

  v_hora_local := (current_timestamp at time zone 'America/Fortaleza')::time;

  if p_tipo = 'saida' and not v_config.permitir_saida_antecipada and v_hora_local < v_config.saida_padrao then
    raise exception 'Saída antecipada não permitida';
  end if;

  select * into v_ultimo
  from public.registros_acesso
  where aluno_id = p_aluno_id
    and data = current_date
    and status = 'registrado'
  order by registrado_em desc
  limit 1
  for update;

  if p_tipo = 'entrada' and v_ultimo.id is not null and v_ultimo.tipo = 'entrada' and not v_config.permitir_reentrada then
    raise exception 'Aluno já possui uma entrada ativa hoje';
  end if;

  if p_tipo = 'saida' and (v_ultimo.id is null or v_ultimo.tipo <> 'entrada') then
    raise exception 'Não existe uma entrada ativa para este aluno';
  end if;

  insert into public.registros_acesso (
    escola_id, aluno_id, ponto_id, data, tipo, metodo, registrado_em,
    device_id, confidence_score, created_by
  )
  values (
    v_aluno.escola_id, p_aluno_id, p_ponto_id, current_date, p_tipo, p_metodo, now(),
    null, p_confidence_score, (select auth.uid())
  )
  returning * into v_novo;

  insert into public.auditoria_frequencia (
    escola_id, registro_id, acao, usuario_id, detalhes
  )
  values (
    v_aluno.escola_id, v_novo.id, 'registrar_' || p_tipo, (select auth.uid()),
    jsonb_build_object('metodo', p_metodo, 'ponto_id', p_ponto_id, 'confidence_score', p_confidence_score)
  );

  return v_novo;
end;
$$;

revoke execute on function public.registrar_acesso_frequencia(uuid,text,text,uuid,numeric) from public, anon;
grant execute on function public.registrar_acesso_frequencia(uuid,text,text,uuid,numeric) to authenticated;

commit;