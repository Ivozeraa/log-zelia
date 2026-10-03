-- Fundação do módulo de controle diário de entrada/saída.
-- A biometria facial ficará desacoplada dos registros operacionais.
-- Padrão da escola: encerramento automático às 16:40.

begin;

create table if not exists public.frequencia_configuracoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  habilitado boolean not null default false,
  reconhecimento_facial_ativo boolean not null default false,
  saida_padrao time without time zone not null default '16:40',
  permitir_saida_antecipada boolean not null default true,
  permitir_reentrada boolean not null default false,
  created_by uuid references public.usuarios(id),
  updated_by uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint frequencia_configuracoes_escola_unique unique (escola_id)
);

create table if not exists public.pontos_verificacao (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  nome text not null,
  local text,
  device_id text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pontos_verificacao_escola_nome_unique unique (escola_id, nome)
);

create table if not exists public.registros_acesso (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete restrict,
  ponto_id uuid references public.pontos_verificacao(id) on delete set null,
  data date not null default current_date,
  tipo text not null check (tipo in ('entrada', 'saida')),
  metodo text not null default 'facial' check (metodo in ('facial', 'manual', 'automatico')),
  status text not null default 'registrado' check (status in ('registrado', 'cancelado')),
  registrado_em timestamptz not null default now(),
  device_id text,
  session_id uuid,
  confidence_score numeric(6,5),
  created_by uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  constraint registros_acesso_confidence_check check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)
  )
);

create table if not exists public.saidas_antecipadas (
  id uuid primary key default gen_random_uuid(),
  registro_acesso_id uuid not null unique references public.registros_acesso(id) on delete cascade,
  motivo text not null,
  descricao text,
  autorizado_por uuid references public.usuarios(id),
  autorizado_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.auditoria_frequencia (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  registro_id uuid references public.registros_acesso(id) on delete set null,
  acao text not null,
  usuario_id uuid references public.usuarios(id),
  detalhes jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_frequencia_configuracoes_escola
  on public.frequencia_configuracoes(escola_id);

create index if not exists idx_pontos_verificacao_escola
  on public.pontos_verificacao(escola_id);

create index if not exists idx_registros_acesso_escola_data
  on public.registros_acesso(escola_id, data);

create index if not exists idx_registros_acesso_aluno_data
  on public.registros_acesso(aluno_id, data, registrado_em);

create index if not exists idx_registros_acesso_turma_lookup
  on public.registros_acesso(escola_id, aluno_id, data);

create index if not exists idx_saidas_antecipadas_registro
  on public.saidas_antecipadas(registro_acesso_id);

create index if not exists idx_auditoria_frequencia_escola_data
  on public.auditoria_frequencia(escola_id, created_at);

alter table public.frequencia_configuracoes enable row level security;
alter table public.pontos_verificacao enable row level security;
alter table public.registros_acesso enable row level security;
alter table public.saidas_antecipadas enable row level security;
alter table public.auditoria_frequencia enable row level security;

drop policy if exists "frequencia_config_select" on public.frequencia_configuracoes;
create policy "frequencia_config_select"
on public.frequencia_configuracoes for select to authenticated
using (
  (select private.current_user_is_global_admin())
  or escola_id = (select private.current_user_school_id())
);

drop policy if exists "frequencia_config_management_write" on public.frequencia_configuracoes;
create policy "frequencia_config_management_write"
on public.frequencia_configuracoes for all to authenticated
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

drop policy if exists "pontos_verificacao_school_select" on public.pontos_verificacao;
create policy "pontos_verificacao_school_select"
on public.pontos_verificacao for select to authenticated
using (
  (select private.current_user_is_global_admin())
  or escola_id = (select private.current_user_school_id())
);

drop policy if exists "pontos_verificacao_management_write" on public.pontos_verificacao;
create policy "pontos_verificacao_management_write"
on public.pontos_verificacao for all to authenticated
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

drop policy if exists "registros_acesso_management_select" on public.registros_acesso;
create policy "registros_acesso_management_select"
on public.registros_acesso for select to authenticated
using (
  (select private.current_user_is_global_admin())
  or escola_id = (select private.current_user_school_id())
);

drop policy if exists "registros_acesso_teacher_select" on public.registros_acesso;
create policy "registros_acesso_teacher_select"
on public.registros_acesso for select to authenticated
using (
  (select private.current_user_role_id()) = 4
  and escola_id = (select private.current_user_school_id())
  and exists (
    select 1
    from public.alunos a
    join public.horario_config_turmas hct on hct.turma_id = a.turma_id
    join public.horario_professor_turma hpt on hpt.config_turma_id = hct.id
    join public.horario_professores hp on hp.id = hpt.professor_id
    where a.id = registros_acesso.aluno_id
      and hp.usuario_id = (select auth.uid())
      and hp.configuracao_id = hpt.configuracao_id
      and hct.escola_id = registros_acesso.escola_id
  )
);

drop policy if exists "registros_acesso_management_write" on public.registros_acesso;
create policy "registros_acesso_management_write"
on public.registros_acesso for all to authenticated
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

drop policy if exists "saidas_antecipadas_school_select" on public.saidas_antecipadas;
create policy "saidas_antecipadas_school_select"
on public.saidas_antecipadas for select to authenticated
using (
  exists (
    select 1 from public.registros_acesso r
    where r.id = saidas_antecipadas.registro_acesso_id
      and (
        (select private.current_user_is_global_admin())
        or r.escola_id = (select private.current_user_school_id())
      )
  )
);

drop policy if exists "saidas_antecipadas_management_write" on public.saidas_antecipadas;
create policy "saidas_antecipadas_management_write"
on public.saidas_antecipadas for all to authenticated
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

drop policy if exists "auditoria_frequencia_select" on public.auditoria_frequencia;
create policy "auditoria_frequencia_select"
on public.auditoria_frequencia for select to authenticated
using (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
);

drop policy if exists "auditoria_frequencia_management_insert" on public.auditoria_frequencia;
create policy "auditoria_frequencia_management_insert"
on public.auditoria_frequencia for insert to authenticated
with check (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (select private.current_user_role_id()) in (2, 3)
  )
);

-- Configuração inicial para escolas existentes. A frequência nasce desligada.
insert into public.frequencia_configuracoes (escola_id)
select e.id
from public.escolas e
where not exists (
  select 1 from public.frequencia_configuracoes fc
  where fc.escola_id = e.id
);

-- Recurso de plataforma: a Gestão decide quando habilitar a frequência em cada escola.
insert into public.logview_recursos (chave, nome, descricao, ativo)
select 'frequencia', 'Frequência', 'Controle diário de entrada e saída com suporte futuro a reconhecimento facial.', true
where not exists (
  select 1 from public.logview_recursos where chave = 'frequencia'
);

insert into public.logview_escola_recursos (escola_id, recurso_id, habilitado)
select e.id, r.id, false
from public.escolas e
cross join public.logview_recursos r
where r.chave = 'frequencia'
  and not exists (
    select 1
    from public.logview_escola_recursos er
    where er.escola_id = e.id
      and er.recurso_id = r.id
  );

commit;
