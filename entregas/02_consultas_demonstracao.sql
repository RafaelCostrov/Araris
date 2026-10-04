SELECT current_database() AS banco,
       current_setting('server_version') AS versao_postgresql;

SELECT table_schema AS esquema, table_name AS tabela
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'accounts_user', 'organizations_organization', 'organizations_membership',
    'finance_customer', 'finance_supplier', 'finance_revenue', 'finance_expense',
    'finance_payable', 'finance_receivable', 'notifications_alert'
  )
ORDER BY table_name;

SELECT u.first_name AS usuario, o.trade_name AS empresa,
       m.role AS papel, m.status AS situacao_vinculo
FROM public.organizations_membership m
JOIN public.accounts_user u ON u.id = m.user_id
JOIN public.organizations_organization o ON o.id = m.organization_id
WHERE o.cnpj = '48510276000162'
ORDER BY u.first_name;

WITH empresa AS (
  SELECT id FROM public.organizations_organization WHERE cnpj = '48510276000162'
)
SELECT 'Clientes' AS entidade, COUNT(*) AS registros FROM public.finance_customer WHERE organization_id IN (SELECT id FROM empresa)
UNION ALL
SELECT 'Fornecedores', COUNT(*) FROM public.finance_supplier WHERE organization_id IN (SELECT id FROM empresa)
UNION ALL
SELECT 'Receitas', COUNT(*) FROM public.finance_revenue WHERE organization_id IN (SELECT id FROM empresa)
UNION ALL
SELECT 'Despesas', COUNT(*) FROM public.finance_expense WHERE organization_id IN (SELECT id FROM empresa)
UNION ALL
SELECT 'Contas a pagar', COUNT(*) FROM public.finance_payable WHERE organization_id IN (SELECT id FROM empresa)
UNION ALL
SELECT 'Contas a receber', COUNT(*) FROM public.finance_receivable WHERE organization_id IN (SELECT id FROM empresa)
UNION ALL
SELECT 'Alertas', COUNT(*) FROM public.notifications_alert WHERE organization_id IN (SELECT id FROM empresa)
ORDER BY entidade;

SELECT r.occurred_on AS data, r.description AS descricao, r.amount AS valor,
       COALESCE(c.name, 'Sem cliente vinculado') AS cliente
FROM public.finance_revenue r
JOIN public.organizations_organization o ON o.id = r.organization_id
LEFT JOIN public.finance_customer c ON c.id = r.customer_id
WHERE o.cnpj = '48510276000162'
ORDER BY r.occurred_on DESC, r.created_at DESC, r.id
LIMIT 10;

SELECT e.occurred_on AS data, e.description AS descricao, e.amount AS valor,
       COALESCE(s.name, 'Sem fornecedor vinculado') AS fornecedor
FROM public.finance_expense e
JOIN public.organizations_organization o ON o.id = e.organization_id
LEFT JOIN public.finance_supplier s ON s.id = e.supplier_id
WHERE o.cnpj = '48510276000162'
ORDER BY e.occurred_on DESC, e.created_at DESC, e.id
LIMIT 10;

WITH movimentos AS (
  SELECT r.organization_id, r.occurred_on, r.amount AS entrada, 0::numeric AS saida
  FROM public.finance_revenue r
  UNION ALL
  SELECT e.organization_id, e.occurred_on, 0::numeric, e.amount
  FROM public.finance_expense e
)
SELECT TO_CHAR(m.occurred_on, 'YYYY-MM') AS mes,
       SUM(m.entrada) AS entradas, SUM(m.saida) AS saidas,
       SUM(m.entrada) - SUM(m.saida) AS resultado_do_mes
FROM movimentos m
JOIN public.organizations_organization o ON o.id = m.organization_id
WHERE o.cnpj = '48510276000162'
GROUP BY TO_CHAR(m.occurred_on, 'YYYY-MM')
ORDER BY mes;

SELECT p.description AS conta, p.status AS situacao, p.amount AS valor_previsto,
       p.due_date AS vencimento, e.occurred_on AS pagamento,
       e.amount AS valor_realizado
FROM public.finance_payable p
JOIN public.organizations_organization o ON o.id = p.organization_id
LEFT JOIN public.finance_expense e ON e.source_payable_id = p.id
WHERE o.cnpj = '48510276000162'
ORDER BY p.due_date, p.id
LIMIT 10;

SELECT p.description AS descricao, p.amount AS valor, p.due_date AS vencimento,
       DATE '2026-10-04' - p.due_date AS dias_de_atraso
FROM public.finance_payable p
JOIN public.organizations_organization o ON o.id = p.organization_id
WHERE o.cnpj = '48510276000162'
  AND p.status = 'pending'
  AND p.due_date < DATE '2026-10-04'
ORDER BY p.due_date, p.id
LIMIT 10;

SELECT t.relname AS tabela, c.conname AS restricao,
       pg_get_constraintdef(c.oid) AS definicao
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN (
    'accounts_user', 'organizations_organization', 'organizations_membership',
    'finance_customer', 'finance_supplier', 'finance_revenue', 'finance_expense',
    'finance_payable', 'finance_receivable', 'notifications_alert'
  )
ORDER BY tabela, restricao;

SELECT tablename AS tabela, indexname AS indice, indexdef AS definicao
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations_membership', 'finance_customer', 'finance_supplier'
  )
  AND indexdef LIKE '% WHERE %'
ORDER BY tabela, indice;
