begin;

create or replace function public.processar_saidas_automaticas_frequencia()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config record;
  v_entry record;
  v_count integer := 0;
  v_saida timestamptz;
  v_saida_id uuid;
begin
  for v_config in
    select escola_id, saida_padrao
    from public.frequencia_configuracoes
    where habilitado = true
  loop
    v_saida := (current_date + v_config.saida_padrao) at time zone 'America/Fortaleza';

    if now() < v_saida then
      continue;
    end if;

    for v_entry in
      select r.*
      from public.registros_acesso r
      where r.escola_id = v_config.escola_id
        and r.data = current_date
        and r.tipo = 'entrada'
        and r.status = 'registrado'
        and r.registrado_em < v_saida
        and not exists (
          select 1
          from public.registros_acesso s
          where s.aluno_id = r.aluno_id
            and s.data = r.data
            and s.tipo = 'saida'
            and s.status = 'registrado'
            and s.registrado_em >= r.registrado_em
        )
    loop
      insert into public.registros_acesso (
        escola_id, aluno_id, ponto_id, data, tipo, metodo, registrado_em, confidence_score, created_at
      )
      values (
        v_entry.escola_id, v_entry.aluno_id, null, v_entry.data, 'saida', 'automatico', v_saida, null, now()
      )
      returning id into v_saida_id;

      insert into public.auditoria_frequencia (
        escola_id, registro_id, acao, usuario_id, detalhes
      )
      values (
        v_entry.escola_id, v_saida_id, 'saida_automatica', null,
        jsonb_build_object('aluno_id', v_entry.aluno_id, 'horario', v_saida)
      );

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.processar_saidas_automaticas_frequencia() from public, anon, authenticated;

commit;