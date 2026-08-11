# Chatbot financeiro do Araris

## Visão geral

O módulo `chatbot` mantém conversas por usuário e empresa, consulta o domínio financeiro por ferramentas controladas e prepara propostas de escrita que dependem de confirmação humana.

O agente usa LangChain 1.x. No Groq, o Qwen 3.6 27B é o modelo principal e o GPT-OSS 20B é o fallback econômico. O Gemini é o fallback final. Também é possível executar com somente uma das chaves de provedor.

## Entidades

- `Conversation`: conversa pertencente a um usuário e uma organização.
- `ChatMessage`: mensagem de usuário ou assistente, com metadados do provedor usado nas respostas.
- `PendingAction`: proposta persistida de criação, edição ou remoção, com prazo de validade e resultado.

Todas as consultas exigem autenticação, membership ativa e organização ativa. Uma conversa ou ação só pode ser aberta pelo próprio usuário dentro da empresa à qual ela pertence.

## Endpoints

```text
GET    /api/chatbot/conversations/
GET    /api/chatbot/conversations/{conversation_id}/
DELETE /api/chatbot/conversations/{conversation_id}/
POST   /api/chatbot/messages/
POST   /api/chatbot/messages/{user_message_id}/retry/
POST   /api/chatbot/actions/{action_id}/confirm/
POST   /api/chatbot/actions/{action_id}/cancel/
```

As listagens, detalhes e exclusões recebem `organization_id` na query string. Os endpoints `POST` recebem `organization_id` no corpo.

### Envio de mensagem

```json
{
  "organization_id": "uuid-da-empresa",
  "conversation_id": null,
  "message": "Quais contas vencem nos próximos 15 dias?"
}
```

Sem `conversation_id`, o backend cria uma conversa e usa o início da pergunta como título. Com um ID, a mensagem é acrescentada ao histórico autorizado. A tela inicial do aplicativo sempre envia `null`, garantindo uma conversa nova; somente a tela de uma conversa aberta reutiliza seu ID.

Se todos os provedores falharem depois que a pergunta já foi persistida, a resposta `503` inclui `conversation_id` e `user_message_id`. O aplicativo usa esse ID para mostrar **Tentar novamente** sem duplicar a pergunta.

### Nova tentativa

```json
{
  "organization_id": "uuid-da-empresa"
}
```

A nova tentativa só aceita uma mensagem do usuário ainda sem resposta. Se já existir uma resposta, o endpoint retorna conflito e não produz uma segunda mensagem do assistente.

### Exclusão de conversa

A exclusão é física e remove a conversa, suas mensagens e propostas relacionadas por cascata. No aplicativo, ela é acionada ao arrastar um chat recente para a esquerda e confirmar a remoção.

## Ferramentas de consulta

O agente pode consultar:

- resumo mensal de entradas, saídas e saldo;
- contas a pagar e a receber pendentes, vencidas ou dentro de um período;
- projeção determinística do caixa entre 7 e 60 dias;
- despesas agrupadas por categoria;
- entradas e saídas realizadas recentemente;
- clientes e fornecedores ativos;
- movimentações e compromissos vinculados a um cliente ou fornecedor.

As ferramentas são construídas com uma organização já autorizada. O modelo não escolhe `organization_id`, não acessa o ORM livremente e recebe apenas os dados necessários para responder.

## Propostas de escrita

O chatbot pode preparar `create`, `update` e `delete` para:

- `payable` e `receivable`;
- `revenue` e `expense`;
- `customer` e `supplier`.

O fluxo é:

1. O agente busca e valida os dados necessários.
2. Uma `PendingAction` é criada com payload, resumo seguro, alvo e expiração.
3. O aplicativo exibe o resumo em um card de confirmação.
4. O usuário confirma, cancela ou escolhe ajustar.
5. Somente o endpoint de confirmação executa a alteração em transação.

A confirmação é idempotente. Edições e remoções guardam a versão do alvo e falham se ele tiver sido modificado depois da preparação. Compromissos são cancelados logicamente, contatos são desativados e a remoção de uma movimentação originada por baixa reabre seu compromisso.

Quando uma proposta é criada, o backend substitui a resposta livre do modelo por uma mensagem curta e deixa valores, datas e categorias somente no card. Se um modelo afirmar que preparou uma proposta sem produzir uma `PendingAction`, a resposta é rejeitada e o próximo modelo da cadeia é acionado. Clientes e fornecedores mencionados são consultados antes de qualquer pergunta sobre cadastro; um vínculo solicitado nunca deve ser omitido silenciosamente.

Pagar ou receber uma conta não faz parte das ferramentas do agente e continua restrito às telas financeiras.

## Provedores e fallback

```env
GROQ_API_KEY=SUA_CHAVE_DO_GROQ
GROQ_MODEL=qwen/qwen3.6-27b
GROQ_FALLBACK_MODEL=openai/gpt-oss-20b
GROQ_REQUEST_TIMEOUT=30
GROQ_MAX_OUTPUT_TOKENS=800
GEMINI_API_KEY=SUA_CHAVE_DO_GEMINI
GEMINI_MODEL=gemini-3.6-flash
GEMINI_REQUEST_TIMEOUT=30
CHATBOT_HISTORY_MESSAGES=6
CHATBOT_ACTION_EXPIRATION_MINUTES=15
```

Regras atuais:

- com Groq e Gemini configurados, o Qwen do Groq é chamado primeiro;
- se o Qwen falhar, o GPT-OSS 20B do Groq recebe a tentativa seguinte;
- se os dois modelos Groq falharem, o Gemini é usado como último fallback;
- com somente uma chave, apenas aquele provedor é usado;
- sem nenhuma chave, a API retorna erro de configuração;
- cada tentativa possui seu próprio coletor de propostas, evitando confirmar ações produzidas por uma tentativa que falhou;
- a mensagem do assistente registra `provider` e `model` nos metadados.
- o histórico enviado é limitado às seis mensagens mais recentes e as respostas Groq têm teto de 800 tokens.

As chaves nunca devem ser expostas no aplicativo nem usar o prefixo `EXPO_PUBLIC_`.

## Aplicativo

- respostas renderizadas em Markdown;
- emojis pontuais orientados pelo prompt, sem excesso;
- até três chats recentes na tela inicial;
- prévias convertidas para texto simples, sem marcadores como `###`;
- cards no padrão visual compartilhado com Home e Dashboard;
- tabs ocultas dentro do chatbot;
- fundo neutro, sem degradê;
- conversa redimensionada com o teclado em iOS e Android;
- retorno fecha o teclado antes de trocar de página;
- gesto lateral para excluir conversas recentes;
- ação de nova tentativa em respostas de erro.

## Testes

```bash
araris-back/.venv/bin/python araris-back/manage.py test apps.chatbot
```

Os 20 testes atuais cobrem isolamento, criação e exclusão de conversas, consultas, fallback, repetição sem duplicação, propostas para as seis entidades, confirmação, cancelamento, expiração, idempotência, concorrência e detecção de alvo alterado.

## Limitações atuais

- sem streaming de resposta;
- sem renomeação manual ou paginação de conversas;
- sem rate limiting, limite por plano ou contabilização de tokens e custos;
- sem telemetria detalhada das ferramentas consultadas;
- sem ferramentas tributárias;
- a qualidade de interpretação ainda precisa ser validada com maior variedade de perguntas reais.
