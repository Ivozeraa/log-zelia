# WhatsApp Cloud API oficial — LogView

> **Status inicial: DESATIVADO.** Nenhum responsável será contatado até a escola configurar a Meta, documentar consentimento e ativar a integração.

## 1. Configurar a Meta (requer ação do administrador da escola)

1. Acessar [Meta for Developers](https://developers.facebook.com/apps/) e criar/configurar um aplicativo com WhatsApp Business Platform.
2. Conectar um WhatsApp Business Account (WABA) e um número empresarial disponível para Cloud API. No ambiente de desenvolvimento, use apenas o número de testes da Meta e destinatários autorizados.
3. Criar um **system user token** apropriado para produção, com acesso ao número/conta e permissão \`whatsapp_business_messaging\`, e obter o **Phone Number ID** (diferente do número visível).
4. No WhatsApp Manager, criar um **modelo de mensagem** em português brasileiro e solicitar aprovação. Sugestão para avaliação (sem variáveis e sem dados sensíveis):

   **Nome sugerido:** \`logview_aviso_responsavel\`
   
   **Idioma:** Português (Brasil) — \`pt_BR\`.
   
   **Categoria para análise:** Utility (a Meta pode decidir outra categoria, inclusive marketing).

   **Texto proposto:** 
   > Olá! A equipe escolar possui uma atualização sobre o acompanhamento do(a) estudante sob sua responsabilidade. Entre em contato com a coordenação da escola para orientações. Para deixar de receber estes avisos, responda SAIR.

   **Não inclua nome do menor, tipo disciplinar, descrição de ocorrência, detalhes médicos ou outras informações sensíveis.**

5. Verificar a [tabela oficial de preços](https://business.whatsapp.com/products/platform-pricing/) e as regras de opt-in e templates. Mensagens automáticas iniciadas pela escola podem gerar custo mesmo usando a Cloud API diretamente, sem intermediários.

## 2. Secrets do Supabase (NUNCA usar VITE_ ou expor ao React)

Em Supabase Dashboard → Edge Functions → Secrets, configurar:

| Secret | Valor |
| --- | --- |
| \`META_WHATSAPP_ACCESS_TOKEN\` | token do system user Meta |
| \`META_WHATSAPP_PHONE_NUMBER_ID\` | ID numérico do número no painel Meta |
| \`META_WHATSAPP_TEMPLATE_NAME\` | nome **exato** do modelo aprovado |
| \`META_GRAPH_VERSION\` | versão Graph API vigente no painel Meta, por exemplo \`v24.0\`, caso esteja suportada |
| \`META_APP_SECRET\` | App Secret do aplicativo Meta; requerido para validar a assinatura dos webhooks |
| \`META_WEBHOOK_VERIFY_TOKEN\` | segredo aleatório escolhido pela escola para o handshake do webhook |
| \`WHATSAPP_DISPATCH_KEY\` | segredo aleatório forte, diferente dos anteriores, compartilhado apenas com Vault/cron |

\`SUPABASE_URL\` e \`SUPABASE_SERVICE_ROLE_KEY\` são disponibilizados pelo projeto ao runtime. **Nunca** envie estes secrets a um chat, commit ou cliente web.

**Callback URL no console Meta:**

\`https://dwhpidekvgsxjqhiqetd.supabase.co/functions/v1/whatsapp-cloud-webhook\`

- Subscribe no campo \`messages\` (eventos de status e mensagens de entrada).
- \`META_WEBHOOK_VERIFY_TOKEN\` deve ser igual ao Verify Token informado na configuração do webhook.
- O webhook valida \`X-Hub-Signature-256\` usando \`META_APP_SECRET\`. Requisições sem assinatura válida são recusadas.
- Responder \`SAIR\`, \`PARAR\`, \`CANCELAR\` ou \`STOP\` retira o opt-in para todos os alunos com aquele contato.

## 3. Agendar processamento seguro na nuvem

Execute **somente depois de configurar as credenciais**, no SQL Editor do Supabase.
Guarde o mesmo valor de \`WHATSAPP_DISPATCH_KEY\` no Vault (não digite aqui a chave verdadeira e não a inclua em uma migration):

\`\`\`sql
select vault.create_secret('COLOQUE_AQUI_A_MESMA_CHAVE_ALEATORIA', 'logview_whatsapp_dispatch_key');
\`\`\`

Para executar a cada minuto, agende:

\`\`\`sql
select cron.schedule(
  'logview-whatsapp-cloud-dispatch',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://dwhpidekvgsxjqhiqetd.supabase.co/functions/v1/enviar-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-key', (select decrypted_secret from vault.decrypted_secrets where name='logview_whatsapp_dispatch_key')
    ),
    body := '{}'::jsonb
  );
  $job$
);
\`\`\`

O endpoint \`enviar-whatsapp\` exige header \`x-dispatch-key\`, mesmo sendo uma função pública sem verificação JWT pelo gateway. Os dados e o token da Meta permanecem exclusivamente na Edge Function. A fila é lida em lotes de até 10, uma única tentativa por ocorrência, sem reenvio cego em caso de timeouts.

## 4. Cadastrar autorização e ativar por escola

1. Em **Gestão → Alunos → Editar**, adicionar nome e WhatsApp do responsável, com DDD, e marcar a confirmação **somente após obter autorização comprovável**. Alterar o número anula o consentimento anterior.
2. Fazer teste com aluno e responsável **de teste**; validar status no webhook antes da ativação geral.
3. Só após a aprovação do modelo, o envio de teste e a autorização dos responsáveis, um administrador do banco pode executar:

\`\`\`sql
-- Substituir pelo UUID real da escola autorizada (não habilitar globalmente).
update public.escolas
set whatsapp_notificacoes_ativas = true
where id = 'UUID_DA_ESCOLA';
\`\`\`

4. Para parar novos envios sem desativar a função:

\`\`\`sql
update public.escolas set whatsapp_notificacoes_ativas=false
where id='UUID_DA_ESCOLA';
\`\`\`

5. Para interromper o agendamento:

\`\`\`sql
select cron.unschedule('logview-whatsapp-cloud-dispatch');
\`\`\`

## 5. Comportamento e segurança

- Fila antiga: 664 registros Z-API pendentes foram marcados \`cancelado_legado\` para **não** gerar cobranças por avisos antigos.
- A fila só recebe ocorrências **novas**, com escola habilitada, telefone preenchido e autorização explícita; uma suspensão derivada de ocorrência original não gera aviso duplicado.
- O worker utiliza somente mensagem de modelo aprovado, sem parâmetros nem detalhes disciplinares.
- \`aceito\` significa aceite da requisição na Meta, **não** entrega. Webhook atualiza \`enviado\`, \`entregue\`, \`lido\` ou \`erro\`.
- Na dúvida sobre resultado (timeout / falha de rede), o status vira \`revisar\` e não é reenviado automaticamente.
- Acesso direto às RPCs internas de fila é revogado de \`anon\` e \`authenticated\`; somente \`service_role\` executa.
- \`whatsapp_notificacoes_ativas\` começa como \`false\` para todas as escolas.
- Evite ativar sem registros de consentimento e revisão de políticas de proteção de dados de crianças e adolescentes.

**Arquivos:** \`supabase/functions/enviar-whatsapp/index.ts\`, \`supabase/functions/whatsapp-cloud-webhook/index.ts\`, migrações \`20261031003201\` e \`20261031003218\`, \`src/pages/StudentManagement.jsx\`.
