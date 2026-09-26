begin;

create or replace function private.teacher_can_view_student(p_aluno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.alunos a
    join public.horario_config_turmas hct on hct.turma_id = a.turma_id
    join public.horario_professor_turma hpt on hpt.config_turma_id = hct.id
    join public.horario_professores hp on hp.id = hpt.professor_id
    where a.id = p_aluno_id
      and hp.usuario_id = (select auth.uid())
      and hp.configuracao_id = hpt.configuracao_id
      and hct.escola_id = a.escola_id
      and a.escola_id = (select private.current_user_school_id())
  );
$$;

revoke execute on function private.teacher_can_view_student(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.teacher_can_view_student(uuid) to authenticated;

drop policy if exists "frequencia_config_management_write" on public.frequencia_configuracoes;
create policy "frequencia_config_insert"
on public.frequencia_configuracoes for insert to authenticated
with check (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
);
create policy "frequencia_config_update"
on public.frequencia_configuracoes for update to authenticated
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
create policy "frequencia_config_delete"
on public.frequencia_configuracoes for delete to authenticated
using (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
);

drop policy if exists "pontos_verificacao_management_write" on public.pontos_verificacao;
create policy "pontos_verificacao_insert"
on public.pontos_verificacao for insert to authenticated
with check (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
);
create policy "pontos_verificacao_update"
on public.pontos_verificacao for update to authenticated
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
create policy "pontos_verificacao_delete"
on public.pontos_verificacao for delete to authenticated
using (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
);

drop policy if exists "registros_acesso_management_write" on public.registros_acesso;
create policy "registros_acesso_insert"
on public.registros_acesso for insert to authenticated
with check (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
);
create policy "registros_acesso_update"
on public.registros_acesso for update to authenticated
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
create policy "registros_acesso_delete"
on public.registros_acesso for delete to authenticated
using (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
);

drop policy if exists "saidas_antecipadas_management_write" on public.saidas_antecipadas;
drop policy if exists "saidas_antecipadas_school_select" on public.saidas_antecipadas;

create policy "saidas_antecipadas_select"
on public.saidas_antecipadas for select to authenticated
using (
  exists (
    select 1
    from public.registros_acesso r
    where r.id = saidas_antecipadas.registro_acesso_id
      and (
        (select private.current_user_is_global_admin())
        or (
          r.escola_id = (select private.current_user_school_id())
          and (
            (select private.current_user_role_id()) in (2, 3)
            or (
              (select private.current_user_role_id()) = 4
              and (select private.teacher_can_view_student(r.aluno_id))
            )
          )
        )
      )
  )
);

create policy "saidas_antecipadas_insert"
on public.saidas_antecipadas for insert to authenticated
with check (
  exists (
    select 1 from public.registros_acesso r
    where r.id = saidas_antecipadas.registro_acesso_id
      and (
        (select private.current_user_is_global_admin())
        or (
          r.escola_id = (select private.current_user_school_id())
          and (select private.current_user_role_id()) in (2, 3)
        )
      )
  )
);
create policy "saidas_antecipadas_update"
on public.saidas_antecipadas for update to authenticated
using (
  exists (
    select 1 from public.registros_acesso r
    where r.id = saidas_antecipadas.registro_acesso_id
      and (
        (select private.current_user_is_global_admin())
        or (
          r.escola_id = (select private.current_user_school_id())
          and (select private.current_user_role_id()) in (2, 3)
        )
      )
  )
)
with check (
  exists (
    select 1 from public.registros_acesso r
    where r.id = saidas_antecipadas.registro_acesso_id
      and (
        (select private.current_user_is_global_admin())
        or (
          r.escola_id = (select private.current_user_school_id())
          and (select private.current_user_role_id()) in (2, 3)
        )
      )
  )
);
create policy "saidas_antecipadas_delete"
on public.saidas_antecipadas for delete to authenticated
using (
  exists (
    select 1 from public.registros_acesso r
    where r.id = saidas_antecipadas.registro_acesso_id
      and (
        (select private.current_user_is_global_admin())
        or (
          r.escola_id = (select private.current_user_school_id())
          and (select private.current_user_role_id()) in (2, 3)
        )
      )
  )
);

create index if not exists idx_frequencia_configuracoes_created_by
  on public.frequencia_configuracoes(created_by);
create index if not exists idx_frequencia_configuracoes_updated_by
  on public.frequencia_configuracoes(updated_by);
create index if not exists idx_pontos_verificacao_escola_id
  on public.pontos_verificacao(escola_id);
create index if not exists idx_registros_acesso_ponto_id
  on public.registros_acesso(ponto_id);
create index if not exists idx_registros_acesso_created_by
  on public.registros_acesso(created_by);
create index if not exists idx_saidas_antecipadas_autorizado_por
  on public.saidas_antecipadas(autorizado_por);
create index if not exists idx_auditoria_frequencia_registro_id
  on public.auditoria_frequencia(registro_id);
create index if not exists idx_auditoria_frequencia_usuario_id
  on public.auditoria_frequencia(usuario_id);

commit;