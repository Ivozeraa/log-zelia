# Auditoria e validação de desempenho — LogZélia

## Objetivo
Diminuir a latência percebida no primeiro acesso sem alterar regras de ocorrência,
suspensão, permissões, frequência e isolamento por escola.

## Alterações feitas
- Login usa o AuthProvider como origem única, sem refresh explícito repetido.
- getUser valida a sessão persistida uma vez; a escola carregada é reutilizada.
- Cache em memória por usuário/escola para recursos e configurações (TTL 30–60 s).
- A nova RPC **logview_get_home_dashboard_v2** devolve totais, gráfico e rankings
  agregados no banco; não devolve o histórico completo. A RPC antiga permanece disponível.
- Tela inicial utiliza a v2, com fallback para v1 quando a v2 ainda não existe.
- TeacherSchedule é renderizado diretamente pela Home, sem observar o DOM global.
- Suspensões geradas, PDF e Excel são carregados sob demanda.
- O login usa a imagem de logo existente e mais leve.
- Avisos deixam de refazer a consulta em toda troca de rota.
- Histórico de exclusões limita a leitura inicial aos 30 mais recentes.

## Sequência segura de implantação
1. Validar o build do Pull Request e testar manualmente em uma implantação de preview.
2. **Aplicada em 29/10/2026** a migration `20261029100000_optimize_home_dashboard_payload.sql`
   no projeto Supabase LogZélia. A v1 continua intacta.
3. **Confirmado**: a RPC v2 está presente, executável por `authenticated`
   e não por `anon`; RLS está ativa em `ocorrencias` e `turmas`.
4. Verificar tela inicial com escola vinculada e admin global, frequência e
   lançamento/edição/exclusão de ocorrências antes de mesclar na main.

## Como medir
Comparar Chrome DevTools Network/Performance em janela anônima, dispositivo
móvel com rede simulada e sessão existente. Registrar ao menos:
- tamanho transferido de JS, imagens e fontes;
- número de chamadas do Supabase até exibir a Home;
- p50 e p95 do tempo de autenticação e da resposta da RPC;
- tempo até conseguir clicar em "Adicionar Advertência";
- LCP (alvo ≤2,5 s), INP (≤200 ms), CLS (≤0,1).

A instrumentação HTTP já existente em `src/utils/supabase.js` pode ser ativada
com `localStorage.setItem("logview:performance-debug", "1")` para diagnóstico
em desenvolvimento, removendo o item ao terminar.

## Pendências que exigem etapa separada
- Paginação **no servidor** de alunos/ocorrências/usuários. As listas atuais
  alimentam relatórios, filtros agregados e seleção em massa; trocar por `range`
  sem separar esses fluxos ocasionaria registros omitidos e relatórios incorretos.
  Implementar com consultas agregadas e consulta dedicada para exportação.
- Converter as imagens JPEG/PNG grandes para WebP/AVIF mantendo os originais:
  a branch já substitui a imagem grande do login pelo logo leve, mas ainda não
  altera bytes binários.
- Confirmar índices adicionais apenas após `EXPLAIN (ANALYZE, BUFFERS)` com
  estatísticas reais e revisão das políticas RLS.

## Validação executada em 29/10/2026
- GitHub Actions `Performance changes validation`: **success** (npm install,
  npm run build). O `package-lock.json` da main está desatualizado e impede
  `npm ci`; a sincronização foi deixada como pendência.
- Vercel: check de implantação da branch com **success**.
- Banco (amostra de uma escola): 227 ocorrências consolidadas na v1 e v2;
  JSON textual da v1 com 34.330 caracteres, da v2 com 3.292 (redução de 90,4%).
  O novo gráfico apresentou 7 posições.
- Os advisors do Supabase sinalizam riscos preexistentes: FKs sem índices,
  índices duplicados, políticas RLS recalculadas por linha e avisos de segurança.
  Ações nesses pontos requerem revisão isolada e testes com EXPLAIN/representante.
- Isso não valida latência p95, segurança de permissões entre usuários nem testes
  end-to-end; devem ser confirmados antes do merge.
