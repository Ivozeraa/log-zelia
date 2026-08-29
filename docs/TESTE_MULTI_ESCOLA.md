# Testes de isolamento multi-escola — LogView

> Este roteiro não cria dados na produção. A segunda escola deve ser criada somente em ambiente de teste/desenvolvimento antes da execução dos cenários de isolamento cruzado.

## Objetivo

Validar que a arquitetura do LogView mantém cada escola isolada no banco, no frontend e nas relações entre registros.

A EEEP Irmã Ana Zélia permanece como a única escola operacional atual.

## Pré-condições

- Uma segunda escola fictícia criada em ambiente de teste.
- Pelo menos um usuário administrativo por escola.
- Alunos, turmas, professores e ocorrências pertencentes a cada escola.
- Pelo menos uma configuração de horários por escola.
- Usuário global separado dos administradores das escolas.

## Matriz de isolamento

| Cenário | Escola A | Escola B | Resultado esperado |
|---|---|---|---|
| Listar alunos | vê A | vê B | isolamento |
| Listar turmas | vê A | vê B | isolamento |
| Listar ocorrências | vê A | vê B | isolamento |
| Consultar horários | vê A | vê B | isolamento |
| Listar usuários | vê A | vê B | isolamento |
| Criar registro | cria em A | cria em B | escola herdada da sessão |
| Informar `escola_id` diferente | bloqueado | bloqueado | RLS/validação |
| Apontar aluno de B em ocorrência de A | bloqueado | bloqueado | integridade relacional |
| Apontar turma de B em horário de A | bloqueado | bloqueado | integridade relacional |
| Administrar outra escola | bloqueado | bloqueado | exceto usuário global |
| Usuário global | pode selecionar | pode selecionar | permitido |

## Dados que nunca devem cruzar escolas

- `usuarios`
- `alunos`
- `turmas`
- `ocorrencias`
- `notificacoes`
- `chamados`
- `feedbacks`
- `ocorrencias_excluidas`
- configurações e tabelas dependentes de horários

## Testes de manipulação de payload

Para cada operação de criação/edição de:

- aluno;
- turma;
- ocorrência;
- usuário;
- configuração de horário;

tentar enviar manualmente um `escola_id` pertencente à outra escola.

Resultado esperado para usuário comum: o identificador enviado pelo cliente não deve conceder acesso; o banco deve aplicar o contexto da sessão ou rejeitar a operação.

## Testes de relações cruzadas

Validar tentativas como:

```text
ocorrencia.escola_id = A
ocorrencia.aluno_id = aluno_de_B
```

```text
turma.escola_id = A
aluno.turma_id = turma_de_B
```

```text
horario.configuracao_id = config_A
horario/turma = turma_de_B
```

Todos devem ser rejeitados.

## Testes do frontend

### Usuário de escola

- Não deve aparecer seletor de escola para operações normais.
- Nome e identidade da escola devem vir do `SchoolContext`.
- Filtros devem iniciar na escola da sessão.
- Payloads devem usar o contexto da sessão.
- A interface não deve permitir escolher outra escola como mecanismo de autorização.

### Usuário global

- Pode selecionar explicitamente uma escola quando a tela oferecer operação global.
- Pode consultar múltiplas escolas quando a funcionalidade for global.
- Deve continuar sujeito às regras de integridade e às validações do banco.

## Testes específicos de horários

Para cada escola:

1. Criar configuração.
2. Vincular turmas da própria escola.
3. Vincular professores da própria escola.
4. Vincular disciplinas/áreas compatíveis.
5. Gerar grade.
6. Consultar grade novamente.

Depois tentar reutilizar qualquer componente da Escola B na configuração da Escola A. O banco deve impedir o cruzamento.

## Critério de aprovação

A arquitetura será considerada pronta para receber uma segunda escola quando:

- nenhuma consulta autenticada de uma escola retornar dados da outra;
- nenhuma criação/edição permitir referência cruzada;
- RLS bloquear acesso direto pelo Data API;
- frontend e banco concordarem sobre a escola atual;
- usuário global funcionar sem abrir privilégios para usuários comuns;
- horários permanecerem isolados por configuração/escola;
- nenhum dado da EEEP Irmã Ana Zélia precisar ser alterado para cadastrar uma segunda escola.

## Regra de produção

Não usar a própria produção da EEEP Irmã Ana Zélia para os testes cruzados. Primeiro validar em ambiente isolado; somente depois cadastrar uma segunda instituição real.
