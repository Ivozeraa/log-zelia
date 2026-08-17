create policy "horario_configuracoes_professor_select" on public.horario_configuracoes for select to authenticated using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role_id = 4 and u.escola_id = horario_configuracoes.escola_id));

create policy "horario_professores_professor_select" on public.horario_professores for select to authenticated using (usuario_id = auth.uid());

create policy "horario_grade_gerada_professor_select" on public.horario_grade_gerada for select to authenticated using (exists (select 1 from public.horario_professores hp where hp.id = horario_grade_gerada.professor_id and hp.usuario_id = auth.uid() and hp.configuracao_id = horario_grade_gerada.configuracao_id));

create policy "horario_config_turmas_professor_select" on public.horario_config_turmas for select to authenticated using (exists (select 1 from public.horario_configuracoes hc join public.usuarios u on u.escola_id = hc.escola_id where hc.id = horario_config_turmas.configuracao_id and u.id = auth.uid() and u.role_id = 4));

create policy "horario_disciplinas_professor_select" on public.horario_disciplinas for select to authenticated using (exists (select 1 from public.horario_configuracoes hc join public.usuarios u on u.escola_id = hc.escola_id where hc.id = horario_disciplinas.configuracao_id and u.id = auth.uid() and u.role_id = 4));
