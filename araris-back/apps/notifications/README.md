# Notificações do Araris

## Visão geral

O módulo de notificações centraliza alertas persistidos, destinatários, dispositivos push e entregas pelo Firebase Cloud Messaging.

O usuário comum pode registrar seu dispositivo, listar suas notificações e marcar uma notificação como lida. Somente usuários administrativos podem disparar notificações manualmente.

Os avisos de compromissos vencidos e que vencem hoje exibidos na Home pertencem ao resumo financeiro e são calculados ao carregar a tela. Eles ainda não geram notificações push automaticamente. A ligação entre eventos financeiros, agendamento e este módulo foi deliberadamente adiada.

## Estrutura atual

### Modelos

- `Alert`: representa o evento ou aviso gerado pelo sistema.
- `Notification`: representa a mensagem e seu estado de processamento.
- `NotificationRecipient`: relaciona a notificação com cada usuário destinatário.
- `PushDevice`: armazena os dispositivos e tokens FCM ativos.
- `ExternalServiceLog`: registra o resultado da comunicação com o Firebase.

### Permissões

- Registro de dispositivo: usuário autenticado.
- Listagem de notificações: usuário autenticado, limitado às próprias notificações.
- Marcação como lida: usuário autenticado, limitado às próprias notificações.
- Envio interno: `IsAdminUser`, exigindo `is_staff=True`.

O endpoint antigo de notificação de teste foi removido.

## Endpoint de envio interno

```text
POST /api/notifications/internal/send/
```

Payload:

```json
{
  "organization_ids": [
    "b3d7ecfc-aeba-460d-b0cc-9faa8cb7a51a",
    "8241094a-0c69-4cfa-89e4-3304245848de"
  ],
  "type": "alert",
  "title": "Aviso do Araris",
  "message": "Notificação enviada pelo fluxo interno.",
  "priority": "medium",
  "data": {
    "source": "manual_internal_test"
  }
}
```

O endpoint aceita até 500 organizações por requisição e remove UUIDs duplicados. Todos os UUIDs precisam existir e todas as organizações precisam possuir ao menos um membro ativo.

O backend resolve automaticamente os destinatários por meio da relação entre `Organization`, `Membership` ativo e `User`.

## Fluxo de processamento

Para cada organização solicitada, o backend:

1. Localiza os membros ativos.
2. Cria um `Alert`.
3. Cria uma `Notification` associada à organização.
4. Cria os `NotificationRecipient` com `bulk_create`.
5. Localiza todos os dispositivos ativos dos destinatários.
6. Envia a mensagem pelo Firebase.
7. Atualiza os destinatários com `bulk_update`.
8. Atualiza o estado da notificação.
9. Cria um `ExternalServiceLog` para a organização.

Cada organização mantém sua própria notificação, seus destinatários e seu log de integração. Isso preserva o isolamento dos dados e permite rastrear falhas individualmente.

## Firebase e volume de dispositivos

O Firebase Admin SDK aceita até 500 tokens em cada chamada multicast. O serviço divide automaticamente os dispositivos em lotes de até 500 tokens.

Exemplos:

- 300 dispositivos: um lote.
- 500 dispositivos: um lote.
- 1.200 dispositivos: três lotes de 500, 500 e 200.

O resultado continua sendo processado por dispositivo. Um usuário é considerado entregue quando ao menos um de seus dispositivos recebe a mensagem com sucesso.

## Retorno do envio

O endpoint retorna um resumo geral e o resultado individual de cada organização:

```json
{
  "organization_count": 2,
  "notification_count": 2,
  "sent_recipient_count": 2,
  "failed_recipient_count": 0,
  "results": [
    {
      "organization_id": "b3d7ecfc-aeba-460d-b0cc-9faa8cb7a51a",
      "alert_id": "uuid-do-alerta",
      "notification_id": "uuid-da-notificacao",
      "status": "sent",
      "recipient_count": 1,
      "sent_at": "2026-06-20T12:00:00-03:00",
      "delivery": {
        "sent": 1,
        "failed": 0,
        "dry_run": false
      }
    }
  ]
}
```

## Central de notificações no aplicativo

A central mobile:

- carrega notificações ao entrar no aplicativo;
- atualiza ao retornar para o primeiro plano;
- atualiza quando um push é recebido com o app aberto;
- exibe uma bolinha no sino enquanto houver notificação não lida;
- apresenta os estados em português;
- permite marcar uma notificação como lida.

## Itens concluídos

- Modelos de alerta, notificação, destinatário e dispositivo.
- Registro de tokens Android e iOS.
- Persistência antes do envio.
- Envio real pelo Firebase Admin SDK.
- Multicast em lotes de até 500 dispositivos.
- Resultados individuais por dispositivo.
- Criação e atualização em lote no banco.
- Logs FCM com tokens mascarados.
- Endpoint administrativo para uma ou várias organizações.
- Resolução automática dos usuários pela organização.
- Bloqueio de disparos para usuários comuns.
- Listagem e leitura de notificações pelo aplicativo.
- Indicador visual de notificações não lidas.
- Estados de entrega traduzidos no aplicativo.
- Testes locais com Firebase mockado.

## Limitações atuais

- O processamento de múltiplas organizações ocorre durante a requisição HTTP.
- Uma quantidade elevada de organizações pode aumentar muito o tempo de resposta.
- Não existem tentativas automáticas para falhas temporárias.
- Tokens FCM inválidos ainda não são desativados automaticamente.
- Não existe agendamento de notificações.
- Não existe uma entidade de campanha para acompanhar disparos amplos.
- Não existe paginação na central de notificações.
- Contas a pagar e a receber ainda não disparam alertas automáticos.
- O módulo tributário ainda não produz alertas de DAS ou limite do MEI.

## Evoluções futuras

### Processamento assíncrono com Redis

Adicionar Redis e Celery para retirar os disparos amplos do ciclo da requisição HTTP.

Fluxo planejado:

1. O administrador cria uma campanha em uma única requisição.
2. O backend valida o público e retorna `202 Accepted` com um identificador.
3. Uma tarefa Celery divide as organizações em blocos.
4. Workers criam notificações e processam os lotes FCM.
5. Falhas temporárias recebem novas tentativas com atraso progressivo.
6. O estado da campanha é atualizado com progresso, sucessos e falhas.

### Campanhas

Criar uma entidade como `NotificationCampaign` com:

- título e mensagem;
- criador;
- público selecionado;
- quantidade de organizações;
- quantidade de destinatários;
- estados pendente, processando, concluída, parcialmente concluída e falha;
- datas de criação, início e conclusão;
- totais de sucesso e falha.

### Confiabilidade

- Desativar tokens inválidos retornados pelo Firebase.
- Implementar idempotência para evitar campanhas duplicadas.
- Adicionar tentativas automáticas para erros transitórios.
- Criar monitoramento de filas e falhas permanentes.
- Definir retenção para logs e notificações antigas.

### Produto

- Criar uma interface administrativa para campanhas.
- Permitir agendamento.
- Permitir segmentação por categoria, status ou plano da organização.
- Adicionar paginação, filtros e contagem de não lidas.
- Integrar alertas automáticos do financeiro e do DAS.
