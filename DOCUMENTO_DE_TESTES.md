# Documento de Testes

## 1. Introdução

Este documento descreve o plano de testes para o projeto `log-zelia`, um sistema de ocorrências escolares desenvolvido em React com Vite e Supabase.

O objetivo é validar os principais fluxos funcionais, as regras de negócio e a usabilidade das telas do sistema.

## 2. Objetivo

- Garantir que o sistema autentique corretamente os usuários.
- Verificar o registro, edição, exclusão e filtragem de ocorrências.
- Validar o dashboard de ocorrências e os indicadores exibidos.
- Confirmar a gestão de usuários e o controle de acesso por perfil.
- Testar a edição de perfil, upload de avatar e alteração de senha.
- Avaliar a alternância entre modo claro e modo escuro.

## 3. Escopo

O escopo cobre:
- Login e rotas protegidas.
- Dashboard inicial (`Home`).
- Tela de ocorrências (`advertencias`).
- Gestão de usuários (`gestao`).
- Configurações de tema (`configuracoes`).
- Edição de perfil (`editar-perfil`).

Fora do escopo:
- Integrações externas não presentes no código atual.
- Testes de performance em larga escala.

## 4. Requisitos Funcionais Principais (inferidos)

1. Usuário deve fazer login via email e senha.
2. Acesso às rotas internas exige autenticação.
3. Usuários com papéis específicos podem acessar a página de gestão.
4. Página Home mostra métricas totais, do mês e da semana, e gráfico por dia.
5. Deve ser possível registrar ocorrências vinculadas a escola, turma, aluno, tipo, categoria e descrição.
6. Categoria `suspensao` exige data de início e término.
7. Tela de ocorrências deve listar alunos, permitir filtros e exibir histórico por aluno.
8. Ocorrências podem ser editadas e excluídas mediante confirmação.
9. Exclusão deve exigir senha do usuário e motivo de exclusão, além de persistir histórico.
10. Gestão deve permitir listar, filtrar, criar, editar e excluir usuários.
11. Usuário pode alternar entre modo claro e escuro.
12. Usuário pode editar nome, avatar e senha no perfil.

## 5. Critérios de Aceitação

- Todos os campos obrigatórios devem ser validados antes do envio.
- Mensagens de erro, sucesso e feedback devem ser exibidas quando apropriado.
- Acesso não autorizado deve redirecionar o usuário para `/login` ou para a página inicial.
- Dados alterados devem permanecer consistentes após recarregar a página.

## 6. Tipos de Teste

- Teste funcional.
- Teste de fluxo de usuário.
- Teste de validação de formulário.
- Teste de segurança de acesso (rota protegida e roles).
- Teste de usabilidade/feedback.

## 7. Casos de Teste

### 7.1 Autenticação

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Tipo |
|---|---|---|---|---|---|
| TC-001 | Login válido | Usuário existente com email/senha válidos | 1. Acessar `/login`<br>2. Informar email válido<br>3. Informar senha válida<br>4. Enviar formulário | Usuário é redirecionado para `/` e vê dashboard | Funcional |
| TC-002 | Login inválido | Usuario existente<br>Senha incorreta | 1. Acessar `/login`<br>2. Informar email válido<br>3. Informar senha errada<br>4. Enviar formulário | Exibe erro `Erro no login`; não permite acesso | Funcional |
| TC-003 | Rota protegida sem login | Navegador sem sessão autenticada | Acessar `/`, `/advertencias`, `/gestao`, `/configuracoes` | Redireciona para `/login` | Segurança |
| TC-004 | Acesso a gestão por role não autorizada | Usuário autenticado com role não 1,2,3 | Acessar `/gestao` | Redireciona para `/` | Controle de acesso |

### 7.2 Dashboard Home

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Tipo |
|---|---|---|---|---|---|
| TC-005 | Carregar dashboard | Usuário autenticado e escola selecionada | Acessar `/` | Métricas `total`, `mês` e `semana` carregam e gráfico apresenta dados | Funcional |
| TC-006 | Seleção de escola | Usuário autenticado com role e escola disponíveis | Selecionar escola diferente | Dados do dashboard atualizam conforme escola selecionada | Funcional |
| TC-007 | Últimas ocorrências | Dados da escola disponíveis | Acessar `/` | Lista de últimas ocorrências exibe até 5 registros mais recentes | Funcional |

### 7.3 Registro de Ocorrência

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Tipo |
|---|---|---|---|---|---|
| TC-008 | Criar ocorrência válida | Usuário autenticado | Preencher escola, turma, aluno, data, tipo, categoria, descrição e enviar | Ocorrência salva e feedback de sucesso exibido | Funcional |
| TC-009 | Validar campos obrigatórios | Usuário autenticado | Enviar formulário com campo vazio | Exibe aviso para preencher todos os campos | Validação |
| TC-010 | Suspensão sem datas | Categoria `suspensao` selecionada sem datas de início/término | Enviar formulário | Exibe aviso `Preencha todos os campos...` ou validação específica | Validação |
| TC-011 | Criar ocorrência `suspensao` válida | Categoria `suspensao` com datas válidas | Enviar formulário | Ocorrência salva com `data_inicio` e `data_fim` | Funcional |

### 7.4 Tela de Ocorrências

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Tipo |
|---|---|---|---|---|---|
| TC-012 | Filtrar por nome | Existem alunos cadastrados | Digitar texto no campo de busca | Lista exibe apenas alunos cujo nome corresponde | Funcional |
| TC-013 | Filtrar por turma | Existem turmas e alunos | Selecionar turma | Lista exibe apenas alunos daquela turma | Funcional |
| TC-014 | Filtrar apenas com ocorrência | Existem alunos com e sem ocorrências | Ativar filtro `Apenas com ocorrência` | Lista exibe apenas alunos com ocorrência registrada | Funcional |
| TC-015 | Paginação de alunos | Mais de 10 alunos filtrados | Navegar para página 2 | Exibe próximos 10 alunos | Funcional |
| TC-016 | Ver detalhes do aluno | Selecionar aluno na lista | Abrir detalhes de aluno | Exibe ocorrências do aluno e histórico | Funcional |

### 7.5 Edição de Ocorrência

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Tipo |
|---|---|---|---|---|---|
| TC-017 | Abrir modal de edição | Ocorrência existente | Clicar em editar | Modal abre com campos preenchidos | Funcional |
| TC-018 | Editar ocorrência válida | Modal aberto com dados | Alterar categoria/tipo/descrição/data e salvar | Ocorrência atualiza e feedback de sucesso aparece | Funcional |
| TC-019 | Validar edição obrigatória | Modal aberto | Remover categoria, tipo ou data e salvar | Exibe `Preencha a categoria, tipo e data da ocorrência.` | Validação |
| TC-020 | Editar suspensão sem datas | Categoria `suspensao` no modal sem datas | Salvar | Exibe aviso para preencher datas de início e término | Validação |

### 7.6 Exclusão de Ocorrência

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Tipo |
|---|---|---|---|---|---|
| TC-021 | Abrir modal de exclusão | Ocorrência selecionada | Clicar em excluir | Modal de confirmação abre | Funcional |
| TC-022 | Excluir sem senha | Modal aberto sem senha | Enviar | Exibe erro `Digite sua senha.` | Validação |
| TC-023 | Excluir sem motivo | Modal aberto com senha | Enviar sem motivo ou motivo muito curto | Exibe erro `Motivo inválido.` | Validação |
| TC-024 | Excluir com senha incorreta | Modal aberto com senha incorreta | Enviar | Exibe erro `Senha incorreta.` e não exclui | Segurança |
| TC-025 | Excluir ocorrência válida | Modal aberto com senha e motivo válidos | Enviar | Ocorrência é removida, histórico salvo e lista atualiza | Funcional |

### 7.7 Gestão de Usuários

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Tipo |
|---|---|---|---|---|---|
| TC-026 | Acessar gestão com role autorizada | Usuário role 1,2 ou 3 | Acessar `/gestao` | Página carrega com lista de usuários | Controle de acesso |
| TC-027 | Filtrar usuários | Usuários existentes | Buscar por nome/email ou filtrar role/escola | Lista é filtrada corretamente | Funcional |
| TC-028 | Criar usuário válido | Modal de adicionar usuário | Preencher nome, email, senha, role e salvar | Usuário criado e aparece na lista | Funcional |
| TC-029 | Validar criação de usuário | Modal aberto com campo obrigatório vazio | Salvar | Exibe erro `Preencha todos os campos obrigatórios.` | Validação |
| TC-030 | Editar usuário | Selecionar usuário e alterar dados | Salvar | Dados do usuário são atualizados | Funcional |
| TC-031 | Excluir usuário | Selecionar usuário e confirmar senha | Excluir | Usuário removido da lista | Funcional |
| TC-032 | Exportar relatório | Na página de gestão | Abrir exportar e gerar PDF | Arquivo PDF é gerado ou download correto | Funcional |

### 7.8 Configurações e Perfil

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Tipo |
|---|---|---|---|---|---|
| TC-033 | Alternar tema | Usuário autenticado | Acessar `/configuracoes` e clicar no botão | Tema muda entre claro e escuro | Funcional |
| TC-034 | Editar nome de perfil | Acessar `/editar-perfil` | Alterar nome e salvar | Nome é atualizado no perfil do usuário | Funcional |
| TC-035 | Upload de avatar | Acessar `/editar-perfil` | Selecionar imagem válida | Avatar é atualizado e mensagem de sucesso exibida | Funcional |
| TC-036 | Alterar senha | Acessar `/editar-perfil` | Informar nova senha e confirmação iguais | Senha é alterada com sucesso | Funcional |
| TC-037 | Validar senha spam | Acessar `/editar-perfil` | Informar senha com menos de 6 caracteres | Exibe `Mínimo 6 caracteres` | Validação |
| TC-038 | Validar senha mismatch | Acessar `/editar-perfil` | Informar senhas diferentes | Exibe `Senhas não coincidem` | Validação |

## 8. Observações Gerais

- Verificar mensagens de notificação exibidas com `notify` nos fluxos de erro e sucesso.
- Confirmar que o `modal` fecha corretamente e restabelece o scroll do corpo.
- Testar comportamento com usuário sem escola definida quando aplicável.
- Revisar acessibilidade básica dos campos e botões.

## 9. Prioridades

- Prioridade alta: login, rotas protegidas, registro/edição/exclusão de ocorrências, filtros, gestão de acesso.
- Prioridade média: edição de perfil, upload de avatar, exportação de PDF, alternância de tema.
- Prioridade baixa: casos de borda de paginação, usabilidade extra, comportamento de notificações em ambiente offline.
