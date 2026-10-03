-- Biometria facial para o terminal de frequência.
-- Armazena apenas o descritor (embedding) gerado pelo @vladmandic/human no navegador,
-- nunca a imagem/frame da câmera. A identificação roda no servidor (RPC), o navegador
-- nunca recebe a lista de descritores de outros alunos.

begin;

create table if not exists public.alunos_biometria_facial (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  descritor double precision[] not null,
  dimensao integer not null,
  modelo text not null default 'human-facematch-v1',
  qualidade numeric(6,5),
  criado_por uuid references public.usuarios(id),
  atualizado_por uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alunos_biometria_facial_aluno_unique unique (aluno_id),
  constraint alunos_biometria_facial_dimensao_check check (dimensao = array_length(descritor, 1)),
  constraint alunos_biometria_facial_qualidade_check check (
    qualidade is null or (qualidade >= 0 and qualidade <= 1)
  )
);

create index if not exists idx_alunos_biometria_facial_escola
  on public.alunos_biometria_facial(escola_id);

alter table public.alunos_biometria_facial enable row level security;

drop policy if exists "alunos_biometria_facial_select" on public.alunos_biometria_facial;
create policy "alunos_biometria_facial_select"
on public.alunos_biometria_facial for select to authenticated
using (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
);

drop policy if exists "alunos_biometria_facial_management_write" on public.alunos_biometria_facial;
create policy "alunos_biometria_facial_management_write"
on public.alunos_biometria_facial for all to authenticated
using (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
)
with check (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
);

-- Ninguém recebe select/insert/update/delete direto além da Gestão: o terminal
-- identifica alunos exclusivamente via a RPC identificar_aluno_frequencia (security definer),
-- que nunca devolve descritores ao cliente.

create or replace function private.cosine_similarity(a double precision[], b double precision[])
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_dot double precision := 0;
  v_norm_a double precision := 0;
  v_norm_b double precision := 0;
  v_i integer;
  v_len integer;
begin
  if a is null or b is null then
    return null;
  end if;

  v_len := array_length(a, 1);
  if v_len is null or v_len <> array_length(b, 1) then
    return null;
  end if;

  for v_i in 1..v_len loop
    v_dot := v_dot + (a[v_i] * b[v_i]);
    v_norm_a := v_norm_a + (a[v_i] * a[v_i]);
    v_norm_b := v_norm_b + (b[v_i] * b[v_i]);
  end loop;

  if v_norm_a = 0 or v_norm_b = 0 then
    return null;
  end if;

  return v_dot / (sqrt(v_norm_a) * sqrt(v_norm_b));
end;
$$;

-- Cadastro (enrollment): somente Gestão/Admin, aluno precisa pertencer à escola do usuário.
create or replace function public.cadastrar_biometria_facial_aluno(
  p_aluno_id uuid,
  p_descritor double precision[],
  p_qualidade numeric default null
)
returns public.alunos_biometria_facial
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aluno public.alunos;
  v_dim integer;
  v_row public.alunos_biometria_facial;
begin
  if not (select private.current_user_is_global_admin())
     and (select private.current_user_role_id()) not in (2, 3) then
    raise exception 'Sem permissão para cadastrar biometria facial';
  end if;

  if p_descritor is null or array_length(p_descritor, 1) is null then
    raise exception 'Descritor facial inválido';
  end if;

  v_dim := array_length(p_descritor, 1);
  if v_dim < 64 then
    raise exception 'Descritor facial inválido';
  end if;

  if p_qualidade is not null and (p_qualidade < 0 or p_qualidade > 1) then
    raise exception 'Qualidade inválida';
  end if;

  select * into v_aluno
  from public.alunos
  where id = p_aluno_id
    and escola_id = (select private.current_user_school_id());

  if not found then
    raise exception 'Aluno não pertence à escola do usuário';
  end if;

  insert into public.alunos_biometria_facial (
    escola_id, aluno_id, descritor, dimensao, qualidade, criado_por, atualizado_por
  )
  values (
    v_aluno.escola_id, p_aluno_id, p_descritor, v_dim, p_qualidade,
    (select auth.uid()), (select auth.uid())
  )
  on conflict (aluno_id) do update set
    descritor = excluded.descritor,
    dimensao = excluded.dimensao,
    qualidade = excluded.qualidade,
    atualizado_por = excluded.atualizado_por,
    updated_at = now()
  returning * into v_row;

  insert into public.auditoria_frequencia (escola_id, registro_id, acao, usuario_id, detalhes)
  values (
    v_aluno.escola_id, null, 'cadastro_biometria_facial', (select auth.uid()),
    jsonb_build_object('aluno_id', p_aluno_id, 'qualidade', p_qualidade, 'dimensao', v_dim)
  );

  return v_row;
end;
$$;

revoke execute on function public.cadastrar_biometria_facial_aluno(uuid, double precision[], numeric) from public, anon;
grant execute on function public.cadastrar_biometria_facial_aluno(uuid, double precision[], numeric) to authenticated;

-- Remoção do cadastro facial de um aluno.
create or replace function public.remover_biometria_facial_aluno(p_aluno_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aluno public.alunos;
begin
  if not (select private.current_user_is_global_admin())
     and (select private.current_user_role_id()) not in (2, 3) then
    raise exception 'Sem permissão para remover biometria facial';
  end if;

  select * into v_aluno
  from public.alunos
  where id = p_aluno_id
    and escola_id = (select private.current_user_school_id());

  if not found then
    raise exception 'Aluno não pertence à escola do usuário';
  end if;

  delete from public.alunos_biometria_facial where aluno_id = p_aluno_id;

  insert into public.auditoria_frequencia (escola_id, registro_id, acao, usuario_id, detalhes)
  values (
    v_aluno.escola_id, null, 'remocao_biometria_facial', (select auth.uid()),
    jsonb_build_object('aluno_id', p_aluno_id)
  );

  return true;
end;
$$;

revoke execute on function public.remover_biometria_facial_aluno(uuid) from public, anon;
grant execute on function public.remover_biometria_facial_aluno(uuid) to authenticated;

-- Identificação facial: roda com segurança do definidor para poder comparar contra todos os
-- descritores da escola sem expor a tabela para o terminal. Só retorna um aluno quando a
-- similaridade passa do limiar E há uma margem clara para o segundo colocado (evita registrar
-- o aluno errado quando dois rostos são parecidos).
create or replace function public.identificar_aluno_frequencia(p_descritor double precision[])
returns table (aluno_id uuid, nome text, similaridade double precision)
language plpgsql
security definer
set search_path = ''
as $$
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
    select
      b.aluno_id,
      a.nome,
      private.cosine_similarity(b.descritor, p_descritor) as sim
    from public.alunos_biometria_facial b
    join public.alunos a on a.id = b.aluno_id
    where b.escola_id = v_escola_id
      and b.dimensao = v_dim
  ),
  ordenado as (
    select *, row_number() over (order by sim desc nulls last) as rn
    from ranked
  )
  select
    max(case when rn = 1 then aluno_id end),
    max(case when rn = 1 then nome end),
    max(case when rn = 1 then sim end),
    max(case when rn = 2 then sim end)
  into v_top1_id, v_top1_nome, v_top1_sim, v_top2_sim
  from ordenado
  where rn <= 2;

  if v_top1_id is null or v_top1_sim is null or v_top1_sim < v_limiar then
    return;
  end if;

  if v_top2_sim is not null and (v_top1_sim - v_top2_sim) < v_margem_minima then
    return;
  end if;

  return query select v_top1_id, v_top1_nome, v_top1_sim;
end;
$$;

revoke execute on function public.identificar_aluno_frequencia(double precision[]) from public, anon;
grant execute on function public.identificar_aluno_frequencia(double precision[]) to authenticated;

commit;
