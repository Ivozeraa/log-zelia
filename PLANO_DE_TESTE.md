# Plano de Testes - Sistema de Ocorrências Log Zelia

## 1. Introdução

### 1.1. Objeto

O objeto deste plano de testes é o sistema de ocorrências escolares `log-zelia`, uma aplicação web desenvolvida em React com Vite, que utiliza Supabase para autenticação, banco de dados e armazenamento.

O software abrange o registro e gestão de ocorrências escolares, dashboard de métricas, filtros e relatórios de usuários, controle de acesso por perfil, edição de perfil de usuário e alternância de tema.

### 1.2. Objetivo

O objetivo do plano de testes é definir as atividades, critérios, escopo e abordagem necessárias para validar as funcionalidades críticas do sistema.

O plano visa garantir que o software atenda aos requisitos funcionais e de usabilidade, que as regras de negócio sejam aplicadas corretamente e que os riscos de qualidade sejam identificados antes da entrega.

## 2. Escopo

### Itens testados

- Login e autenticação via email e senha.
- Navegação e proteção das rotas internas `/`, `/advertencias`, `/gestao`, `/configuracoes` e `/editar-perfil`.
- Dashboard Home com métricas totais, do mês e da semana, gráfico de ocorrências e última lista de ocorrências.
- Registro de ocorrências, incluindo validação de campos obrigatórios e categoria de suspensão com datas de início e fim.
- Tela de ocorrências (advertências) com filtros por nome, turma, presença de ocorrência, paginação e detalhe por aluno.
- Edição de ocorrências com validação de campos e fluxos de atualização.
- Exclusão de ocorrências com autenticação por senha, motivo de exclusão e registro em histórico.
- Gestão de usuários com listagem, filtragem, criação, edição, exclusão e exportação.
- Configurações de tema (modo claro / modo escuro).
- Edição de perfil, upload de avatar e alteração de senha.

### Itens não testados

- Integrações externas não cobertas pelo código atual, além do Supabase.
- Testes de instalação de ambiente ou deploy.
- Testes de performance em larga escala e escalabilidade de produção.
- Testes de compatibilidade com navegadores muito antigos ou sistemas operacionais não contemplados no ambiente de desenvolvimento.

## 3. Abordagem

A realização dos testes será feita por meio de testes manuais funcionais, com foco na experiência do usuário e nas regras de negócio implementadas no front-end.

As técnicas incluem: validação de formulários, testes de fluxo de uso, testes de controle de acesso por perfil e testes de regressão. Serão utilizadas ferramentas de gerenciamento de bugs e registros de execução manual, além de possíveis scripts de automação de componentes ou fluxos críticos no futuro.

Critérios de início:
- Aplicação compilada e executável em ambiente de desenvolvimento.
- Base de dados de teste carregada com dados representativos de escolas, turmas, alunos e usuários.

Critérios de aprovação:
- Todos os casos de teste críticos concluídos com sucesso.
- Defeitos críticos corrigidos ou mitigados.
- Cobertura mínima dos fluxos de autenticação, registro/edição/exclusão de ocorrências e controle de acesso.

Critérios de encerramento:
- Validação do conjunto de casos de teste planejados.
- Relatório de incidentes atualizado.
- Aprovação dos stakeholders responsáveis pela qualidade.

Critérios de suspensão:
- Ambiente de teste indisponível.
- Falhas de infraestrutura que impedem a execução de casos críticos.
- Bloqueios de acesso ao Supabase ou à base de dados de teste.

Critérios de retomada:
- Disponibilidade do ambiente restabelecida.
- Correção dos bloqueios registrados.
- Revalidação dos casos de teste afetados.

## 4. Missão de Avaliação e Motivação dos Testes

O objetivo desta iteração de testes é validar a qualidade funcional do sistema de ocorrências `log-zelia`, com foco em processos críticos de autenticação, gestão de ocorrências, controle de acesso e edição de perfil.

### 4.1 Fundamentos

O principal problema que este teste resolve é garantir que a aplicação entregue aos usuários escolares funcione corretamente nos fluxos essenciais: login, registro de ocorrências, visualização de métricas e gestão de usuários.

A solução se baseia em uma arquitetura web moderna, com React no front-end e Supabase como backend SaaS para autenticação e persistência. O histórico do projeto revela uma aplicação que já implementa funcionalidades completas de CRUD e gerenciamento de permissões, mas que precisa de validação sistemática para reduzir riscos de regressão.

Testar esta aplicação permite identificar inconsistências de interface, falhas de validação, erros de navegação e problemas de segurança de rota antes que sejam entregues em produção.

### 4.2 Missão de Avaliação

A missão do esforço de avaliação é localizar os maiores riscos funcionais e de qualidade perceptível para o usuário final, assegurando que os fluxos de cadastro, edição, exclusão e visualização de ocorrências, bem como o controle de acesso, sejam confiáveis e usáveis.

### 4.3 Motivadores dos Testes

- Risco de falha em fluxos de negócio críticos, como exclusão de ocorrência e validação de suspensão.
- Risco de acesso indevido a páginas administrativas por perfis não autorizados.
- Dependência de autenticação e sessão para navegação interna.
- Complexidade de filtragem, paginação e relatórios no módulo de ocorrências.
- Necessidade de feedback claro ao usuário em ações comuns como salvar, editar e excluir.

## 5. Itens de Teste-Alvo

- Aplicação front-end React (`src/`), incluindo páginas `Home`, `Occurrences`, `Management`, `Settings`, `Login`, `EditProfile`.
- Módulos de autenticação e autorização (`AuthContext`, `ProtectedRoute`).
- Componentes de UI reutilizáveis: `Button`, `Modal`, `ToastProvider`.
- Integrações Supabase para autenticação, consulta e modificação de dados.
- Dados de suporte: escolas, turmas, alunos, ocorrências, usuários.
- Navegadores compatíveis em ambiente de desenvolvimento (Chrome/Edge/Firefox atuais).

## 6. Resumo dos Testes Planejados

### 6.1 Resumo das Inclusões dos Testes

Serão executados testes funcionais e de fluxo integrando a interface do usuário com as regras de negócio.

Incluem-se:
- Testes de login e rotas protegidas.
- Testes de dashboard e métricas.
- Testes de cadastro, edição, exclusão e filtros de ocorrências.
- Testes de gestão de usuários e controle de acesso por perfil.
- Testes de edição de perfil e configurações de tema.

### 6.2 Resumo dos Outros Candidatos a Possível Inclusão

- Automação parcial de testes de interface com ferramentas de end-to-end (ex.: Cypress).
- Testes de banco de dados direto para validar integridade das tabelas `ocorrencias`, `usuarios` e `ocorrencias_excluidas`.
- Testes de regressão automatizados em scripts de login e CRUD.

### 6.3 Resumo das Exclusões dos Testes

Não serão executados neste plano:
- Testes de performance em alta carga e stress.
- Testes de instalação e deploy.
- Testes de compatibilidade com navegadores muito antigos.
- Testes de recuperação de desastres e tolerância a falhas de hardware.

## 7. Abordagem dos Testes

Os testes serão realizados manualmente, com possíveis evidências e relatórios em planilhas ou ferramentas de gestão de defeitos.

A técnica primária será o teste de funcionamento, aplicado por casos de uso e requisitos inferidos do código.

### 7.1 Catálogos Iniciais de Ideias de Teste e Outras Fontes de Referência

- Código-fonte das páginas `Home.jsx`, `Occurrences.jsx`, `Management.jsx`, `Login.jsx`, `EditProfile.jsx`.
- Componentes `AuthContext.jsx`, `ProtectedRoute.jsx`, `Modal.jsx`.
- Requisitos inferidos do mapa de navegação e funcionalidades existentes.
- Documentos de requisitos fornecidos pelo projeto e pelo cliente.

### 7.2 Tipos e Técnicas de Teste

#### 7.2.1 Teste de Integridade de Dados e de Banco de Dados

Objetivo da Técnica:
- Verificar que os dados de ocorrências e usuários estão corretos e que ações de exclusão e edição gravam as alterações conforme esperado.

Técnica:
- Consultar tabelas de teste e verificar correspondência entre UI e dados armazenados.
- Inserir dados válidos/ inválidos e confirmar a persistência correta.

Estratégias:
- Usar queries de banco de dados de teste para comparar resultados com o comportamento da aplicação.
- Validar que operações CRUD alteram as tabelas `ocorrencias`, `usuarios` e `ocorrencias_excluidas`.

Ferramentas Necessárias:
- Console ou cliente SQL do Supabase.
- Ferramentas de inspeção de dados do banco de teste.

Critérios de Êxito:
- Dados alterados pela aplicação correspondem ao banco de dados.
- Operações de exclusão gravam o histórico correto.

Considerações Especiais:
- Usar um banco de dados de teste não produtivo.
- Evitar alterações diretas no banco em ambiente de produção.

#### 7.2.2 Teste de Funcionamento

Objetivo da Técnica:
- Validar os fluxos de uso do usuário final, incluindo login, cadastro de ocorrência, edição, exclusão, filtragem, gestão de usuários e edição de perfil.

Técnica:
- Executar casos de uso com dados válidos e inválidos.
- Verificar mensagens de erro e sucesso.

Estratégias:
- Testar cenários manuais com preenchimento completo e com falhas de preenchimento.
- Conferir o comportamento da interface diante de dados de entrada incorretos.

Ferramentas Necessárias:
- Navegador web moderno.
- Ferramenta de registro de defeitos (planilha ou software de bug tracking).

Critérios de Êxito:
- Principais casos de uso funcionam sem falhas.
- Regras de negócio são aplicadas corretamente.

Considerações Especiais:
- A dependência de Supabase pode exigir controle de ambiente e credenciais de teste.

#### 7.2.3 Teste de Ciclos de Negócios

Objetivo da Técnica:
- Avaliar o funcionamento do sistema ao longo de um ciclo de uso típico, como registro e gestão de ocorrências em um período de uso contínuo.

Técnica:
- Simular transações repetidas de registro e consultas de ocorrência.
- Verificar se relatórios, métricas e filtros se mantêm consistentes após várias operações.

Estratégias:
- Repetir os principais casos de uso em sequência: login, criar ocorrência, editar ocorrência, excluir ocorrência, consultar relatórios.

Ferramentas Necessárias:
- Navegador web e ambiente de teste estável.

Critérios de Êxito:
- Fluxos repetidos continuam funcionando sem degradação aparente.

Considerações Especiais:
- Não há processamento de agendamentos complexos além das datas de suspensão.

#### 7.2.4 Teste de Interface do Usuário

Objetivo da Técnica:
- Verificar navegação, usabilidade, estado de campos e objetos de interface.

Técnica:
- Testar telas principais para garantir que botões, modais e inputs funcionam.
- Verificar navegação da página principal para páginas internas.

Estratégias:
- Testar tabulação, foco em campos e feedback visual.
- Confirmar que modais abrem e fecham corretamente.

Ferramentas Necessárias:
- Navegador web.
- Possível automação básica de UI no futuro.

Critérios de Êxito:
- A navegação e os controles da interface funcionam conforme esperado.

Considerações Especiais:
- Algumas propriedades visuais de terceiros podem não ser totalmente verificáveis sem automação.

#### 7.2.5 a 7.2.12

Os testes de desempenho, carga, stress, volume, segurança, tolerância a falhas, configuração e instalação não fazem parte do escopo principal deste plano, mas podem ser considerados em iterações futuras se houver necessidade de validação técnica mais profunda do ambiente e da infraestrutura.

## 8. Critérios de Entrada e de Saída

### 8.1 Plano de Teste

#### 8.1.1 Critérios de Entrada de Plano de Teste

- Código fonte disponível e compilável.
- Ambiente de teste configurado e acessível.
- Dados de teste carregados no Supabase.
- Casos de teste definidos e aprovados.

#### 8.1.2 Critérios de Saída de Plano de Teste

- Casos de teste críticos executados.
- Defeitos críticos registrados e avaliados.
- Relatório de status entregue aos stakeholders.

#### 8.1.3 Critérios de Suspensão e de Reinício

Suspender se:
- O ambiente de teste ficar indisponível.
- Erros de infraestrutura impedirem a execução.
- Credenciais de teste estiverem inválidas.

Retomar se:
- Ambiente restabelecido.
- Problemas corrigidos ou contornados.
- Casos de teste afetados revalidados.

### 8.2 Ciclos de Teste

#### 8.2.1 Critérios de Entrada de Ciclo de Teste

- Build do sistema disponível.
- Dados de teste atualizados.
- Objetivos do ciclo definidos.

#### 8.2.2 Critérios de Saída de Ciclo de Teste

- Todos os casos do ciclo executados.
- Defeitos analisados e priorizados.
- Status de qualidade documentado.

#### 8.2.3 Término Anormal do Ciclo de Teste

- O ciclo será encerrado antecipadamente se o ambiente ficar indisponível ou se houver bloqueios irreparáveis que impeçam validações críticas.

## 9. Produtos Liberados

### 9.1 Sumários de Avaliação de Testes

Serão gerados relatórios resumidos com o status dos casos de teste executados, incluindo pass/fail e defeitos críticos identificados. Frequência: ao término de cada ciclo de teste.

### 9.2 Geração de Relatórios sobre Cobertura de Teste

Será documentada a cobertura dos principais fluxos funcionais do sistema e a relação entre casos de teste e requisitos críticos, usando planilhas ou ferramenta de rastreabilidade simples.

### 9.3 Relatórios da Qualidade Perceptível

Relatórios de qualidade perceptível descreverão a experiência do usuário nas telas principais, incluindo usabilidade e feedback de erros.

### 9.4 Registros de Incidentes e Solicitações de Mudança

Os defeitos serão registrados em ferramenta de controle ou planilha, com status e prioridade. Mudanças solicitadas serão documentadas e avaliadas.

### 9.5 Conjunto de Testes de Regressão e Scripts de Teste de Suporte

Será mantido um conjunto básico de testes de regressão manual para os fluxos críticos de login, ocorrências, gestão de usuários e perfil.

### 9.6 Produtos de Trabalho Adicionais

#### 9.6.1 Resultados Detalhados dos Testes

Dependendo da necessidade, os resultados poderão ser mantidos em planilhas ou no repositório de defeitos.

#### 9.6.2 Scripts de Teste Funcionais Automatizados Adicionais

Podem ser criados scripts de automação em ciclo futuro, caso o projeto avance para um ambiente mais formal de testes automatizados.

#### 9.6.3 Guia de Teste

Um guia de teste básico será mantido como parte deste plano de teste e dos casos de teste associados.

#### 9.6.4 Matrizes de Rastreabilidade

Se necessário, poderá ser criada uma matriz simples relacionando casos de teste a requisitos funcionais.

## 10. Fluxo de Trabalho de Teste

O fluxo de trabalho seguirá estas etapas:
1. Planejar teste e identificar requisitos.
2. Definir casos de uso e casos de teste.
3. Preparar ambiente e dados.
4. Executar casos de teste manualmente.
5. Registrar resultados e incidentes.
6. Reexecutar casos após correções.
7. Gerar sumário e reporte de status.

## 11. Necessidades Ambientais

### 11.1 Hardware Básico do Sistema

- PCs de teste comuns com navegador moderno.
- Máquina de desenvolvimento/servidor de teste com acesso ao Supabase.

### 11.2 Elementos de Software Básicos do Ambiente de Teste

- Sistema operacional Windows ou macOS.
- Navegador: Chrome, Edge ou Firefox recentes.
- IDE / editor para inspecionar código e logs.
- Acesso ao projeto `log-zelia` e ao Supabase de teste.

### 11.3 Ferramentas de Produtividade e de Suporte

- Planilha ou ferramenta de rastreio de defeitos.
- Ferramenta de navegação web.
- Ferramenta de comunicação entre equipe.

### 11.4 Configurações do Ambiente de Teste

- Ambiente local com build da aplicação React em execução.
- Banco de dados de teste Supabase com dados representativos.
- Navegador configurado para execução de testes funcionais.

## 12. Responsabilidades, Perfil da Equipe e Necessidades de Treinamento

### 12.1 Pessoas e Papéis

- Gerente de Testes: supervisiona o plano, alinha recursos e reporta status.
- Analista de Teste: define casos de teste, avalia resultados e documenta incidentes.
- Testador: executa os testes e registra achados.
- Administrador de Sistema / Banco de Dados: garante acesso ao ambiente de teste e ao Supabase.

### 12.2 Perfil da Equipe e Necessidades de Treinamento

A equipe deve ter conhecimento em testes funcionais de aplicações web, React, fluxo de autenticação e princípios de qualidade de software.

O treinamento recomendado inclui:
- Execução de testes manuais de UI.
- Uso de ferramentas de registro de defeitos.
- Noções básicas de navegação e inspeção de aplicações React.
