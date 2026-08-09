# Financeiro do Araris

## Visão geral

O módulo financeiro registra entradas e saídas realizadas, organiza contas a pagar e receber e consolida os dados exibidos na Home do aplicativo.

Todas as operações exigem autenticação e uma membership ativa na empresa informada. Uma empresa que não pertence ao usuário retorna como não encontrada.

## Entidades

- `Revenue`: entrada financeira já recebida.
- `Expense`: saída financeira já paga.
- `Payable`: compromisso que ainda precisa ser pago.
- `Receivable`: valor que ainda precisa ser recebido.
- `Customer`: cliente que pode ser associado opcionalmente a receitas e contas a receber.
- `Supplier`: fornecedor que pode ser associado opcionalmente a despesas e contas a pagar.

Categorias e formas de pagamento são predefinidas e expostas com código e rótulo em português.

## Endpoints

```text
GET|POST /api/finance/customers/
GET|PATCH|DELETE /api/finance/customers/{id}/
GET|POST /api/finance/suppliers/
GET|PATCH|DELETE /api/finance/suppliers/{id}/
GET|POST /api/finance/revenues/
PATCH|DELETE /api/finance/revenues/{id}/
GET|POST /api/finance/expenses/
PATCH|DELETE /api/finance/expenses/{id}/
GET|POST /api/finance/payables/
PATCH|DELETE /api/finance/payables/{id}/
POST     /api/finance/payables/{id}/settle/
GET|POST /api/finance/receivables/
PATCH|DELETE /api/finance/receivables/{id}/
POST     /api/finance/receivables/{id}/settle/
GET      /api/finance/summary/
GET      /api/finance/dashboard/
```

As listagens recebem `organization_id` na query string. As criações recebem `organization_id` no corpo.

Clientes e fornecedores possuem nome obrigatório e CPF/CNPJ, e-mail, telefone e observações opcionais. A remoção é lógica: o cadastro deixa de aparecer em novos lançamentos, mas permanece associado ao histórico financeiro.

As listagens e o resumo aceitam `month=AAAA-MM`. Entradas, saídas e compromissos são filtrados pelo período selecionado. O filtro de vencidos ignora o mês para que nenhuma pendência atrasada desapareça.

Contas a pagar e receber aceitam o filtro `status`:

- `all`
- `pending`
- `due_today`
- `overdue`
- `completed`
- `canceled`

O estado vencido é calculado a partir da data de vencimento enquanto o compromisso permanece pendente. Isso evita depender de um scheduler nesta etapa.

## Criação de uma conta a pagar

```json
{
  "organization_id": "uuid-da-empresa",
  "description": "Conta de energia",
  "amount": "180.50",
  "due_date": "2026-08-15",
  "category": "utilities",
  "supplier_id": "uuid-opcional-do-fornecedor",
  "recurrence": "bimonthly",
  "occurrences": 6,
  "notes": "Referente ao mês de agosto"
}
```

Receitas e contas a receber aceitam `customer_id`; despesas e contas a pagar aceitam `supplier_id`. Os dois vínculos são opcionais. Uma baixa copia o vínculo do compromisso para a movimentação realizada, e a edição da movimentação mantém o compromisso de origem sincronizado.

`recurrence` pode ser `none`, `weekly`, `fortnightly`, `monthly`, `bimonthly`, `quarterly`, `semiannual` ou `annual`. Uma recorrência definida exige entre 2 e 60 ocorrências e cria toda a série de forma transacional. Com `recurrence_indefinite: true`, a série fica sem data final: o sistema mantém uma janela futura de doze meses e a amplia automaticamente conforme o módulo é consultado. Cada compromisso informa seu grupo, posição e total da série.

## Baixa de um compromisso

```json
{
  "date": "2026-08-08",
  "payment_method": "pix"
}
```

A baixa é transacional:

- pagar uma `Payable` cria uma `Expense` vinculada;
- receber uma `Receivable` cria uma `Revenue` vinculada;
- cada compromisso pode gerar somente um lançamento realizado;
- uma segunda tentativa de baixa é rejeitada;
- a data da baixa não pode estar no futuro.

Entradas e saídas realizadas podem ser editadas ou removidas. Quando uma movimentação foi gerada pela baixa de um compromisso, a edição mantém os dados do compromisso sincronizados. A remoção reabre o compromisso como pendente e limpa os dados da baixa.

Compromissos pendentes também podem ser editados ou excluídos. A edição aceita descrição, valor, vencimento, categoria, observações e cliente ou fornecedor. Em séries recorrentes, somente a ocorrência escolhida é alterada. A exclusão é lógica: muda o estado para `canceled`, preserva o histórico da série e remove a ocorrência das listas ativas. Compromissos já pagos ou recebidos não podem ser alterados por esses endpoints.

## Resumo financeiro

O endpoint de resumo retorna:

- entradas do mês selecionado;
- saídas do mês selecionado;
- saldo acumulado até o fim do mês selecionado;
- contas a pagar e receber no período;
- totais globais de compromissos vencidos;
- totais e contadores separados para pendências vencidas e que vencem hoje;
- últimas entradas e saídas realizadas.

## Dashboard e projeção de caixa

O endpoint `GET /api/finance/dashboard/` recebe `organization_id`,
`month=AAAA-MM` e `history_months=3|6|12`. Ele retorna:

- saldo atual realizado;
- projeção diária dos próximos 30 dias;
- menor saldo e data de maior risco;
- totais a pagar e receber dentro do horizonte;
- histórico mensal de entradas e saídas;
- despesas agrupadas por categoria no mês selecionado;
- entradas agrupadas por cliente no mês selecionado;
- saídas agrupadas por fornecedor no mês selecionado;
- compromissos que mais impactam o caixa;
- indicadores determinísticos do período.

A projeção adiciona contas a receber e subtrai contas a pagar na data de
vencimento. Pendências vencidas entram no primeiro dia do horizonte. Séries
recorrentes sem data final são ampliadas antes do cálculo, garantindo que todas
as ocorrências dos próximos 30 dias sejam consideradas.

Nas segmentações por cliente e fornecedor, são retornados os cinco maiores
vínculos. Os demais valores e todos os lançamentos sem vínculo são somados em
um único grupo `Outros`.

## Aplicativo

A tela central permite registrar:

- entrada recebida;
- saída paga;
- conta a receber;
- conta a pagar.

Ela também lista compromissos pendentes, vencidos e concluídos e permite executar a baixa. A Home consome o resumo financeiro e apresenta somente dados persistidos pela API. O aviso de vencidos abre uma listagem conjunta de contas a pagar e receber, mantendo as ações de baixa disponíveis.

O aplicativo permite cadastrar, editar e desativar clientes e fornecedores, além de selecioná-los opcionalmente na criação e na edição de atividades. A seleção possui busca por texto e limita os resultados visíveis, evitando listas extensas no formulário.

## Integração com o chatbot

O módulo `chatbot` consulta os dados financeiros por ferramentas internas que já recebem uma organização autorizada. Ele pode preparar criações, edições e remoções de movimentos, compromissos, clientes e fornecedores, mas nunca executa a alteração diretamente durante a resposta da LLM.

Cada proposta é persistida e só é aplicada depois da confirmação explícita do usuário em um endpoint autenticado. Pagamentos e recebimentos não são oferecidos como ferramentas do chatbot e permanecem restritos aos endpoints de baixa e às telas financeiras.

## Conta local de demonstração

O comando idempotente abaixo cria ou atualiza uma conta de demonstração voltada a um salão de beleza:

```bash
araris-back/.venv/bin/python araris-back/manage.py seed_demo_account \
  --email b@a.com \
  --password 'Senha@1235'
```

Ele prepara a usuária Millena, a empresa `Studio Millena Cabelos & Beleza`, clientes, fornecedores, movimentos entre março e agosto de 2026, séries recorrentes e pendências futuras. Também mantém duas contas a pagar vencidas em 08/08/2026 — reposição de tinturas e manutenção do lavatório — para demonstrar o widget de urgência da Home.

O seed usa `update_or_create`, pode ser repetido sem multiplicar os registros previstos e não cria conversas do chatbot.

## Próximos passos

- Alertas automáticos de vencimento.
- Parcelamentos com valores diferentes por parcela.
- Paginação e filtros por período.
