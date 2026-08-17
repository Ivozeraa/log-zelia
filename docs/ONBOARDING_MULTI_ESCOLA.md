# Onboarding de nova escola

A EEEP Irmã Ana Zélia da Fonseca continua sendo a escola operacional atual. Este documento define somente como uma segunda escola deverá ser adicionada no futuro, sem copiar dados da escola existente.

## Princípio

Uma escola nova nasce com identidade e `id` próprios. Nenhum aluno, turma, usuário, horário ou ocorrência da EEEP Ana Zélia é reaproveitado automaticamente.

## Ordem segura

1. Criar o registro em `escolas`.
2. Criar o administrador inicial vinculado ao novo `escola_id`.
3. Cadastrar turmas e professores dessa escola.
4. Importar alunos usando o `escola_id` da nova escola.
5. Criar a primeira configuração de horários da nova escola.
6. Validar RLS com um usuário da nova escola.
7. Só então liberar o ambiente para uso.

## Regras

- Nunca copiar `escola_id` da EEEP Ana Zélia.
- Nunca confiar em `escola_id` enviado pelo navegador como mecanismo de autorização.
- Usuários comuns ficam vinculados a uma única escola.
- Operações multi-escola ficam restritas a contas globais.
- O banco permanece como autoridade final através de RLS, constraints e validações relacionais.

## Estado atual

Neste momento existe somente o ambiente operacional da EEEP Irmã Ana Zélia da Fonseca. Nenhuma escola de teste deve ser criada no banco de produção apenas para validar o conceito.
