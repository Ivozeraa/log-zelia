# E-mail verificado para estudantes (LogView)

O Portal do Aluno utiliza matrícula/senha (não Supabase Auth). O fluxo de e-mail usa uma Edge Function pública por necessidade de acesso dos estudantes sem JWT, mas **todas as consultas privilegiadas ocorrem no servidor**, com RPCs internos revogados de anon/authenticated e RLS ativo.

## Ativação do envio (obrigatória)

1. Verifique um domínio de envio na plataforma Resend e configure SPF/DKIM conforme o provedor.
2. No projeto Supabase LogZélia, configure os secrets da Edge Function:
   - `RESEND_API_KEY` (a chave existente deve estar ativa);
   - `RESEND_FROM_EMAIL` (endereço do domínio verificado, exemplo: `noreply@seudominio.com`).
3. Nunca use `onboarding@resend.dev` em produção. A função recusa esse remetente.
4. Faça um teste manual com matrícula de teste e e-mail controlado: autenticar, solicitar código, confirmar endereço, sair e redefinir senha via e-mail.
5. Verifique nos logs de execução da função `student-email` se houve recusas do Resend.

Até a configuração ser feita, a função retorna indisponibilidade e a interface não habilita o cadastro — **não** simula envio.

## Segurança

- Só matrícula + senha válidas podem solicitar/confimar um e-mail.
- Somente e-mails **confirmados** podem receber códigos de recuperação.
- Código de 6 dígitos, único, expira em 10 minutos, máximo de 5 tentativas.
- Hash HMAC com segredo do servidor em vez de gravar códigos abertos.
- Máximo de 3 códigos/hora e 6/dia por estudante, com limite por origem de rede.
- Respostas de solicitação de recuperação não revelam a existência de uma conta.
- O e-mail só entra na coluna `alunos.email` após confirmação e alterações administrativas do endereço invalidam a confirmação.
- Os códigos e o rate limiting ficam em tabelas com RLS e sem acesso direto para anon/authenticated.
- Limpeza periódica dos tokens via cron `logview-student-email-cleanup`.
- A implementação mantém temporariamente o hash legado SHA-256 da autenticação estudantil por compatibilidade. Planeje uma migração controlada para Argon2id/bcrypt com suporte de login legado e testes de regressão antes de ativar contas em larga escala.

## Arquivos relacionados

- `supabase/migrations/20261031000459_add_verified_student_email_and_secure_recovery_codes.sql`
- `supabase/migrations/20261031000840_student_email_rate_limits_and_cleanup.sql`
- `supabase/functions/student-email/index.ts`
- `src/services/studentEmail.js`
- `src/components/student/StudentEmailSettings.jsx`
- `src/pages/StudentPasswordRecovery.jsx`
