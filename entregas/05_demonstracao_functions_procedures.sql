SELECT routine_schema, routine_name, routine_type, data_type
FROM information_schema.routines
WHERE routine_schema = 'academic'
ORDER BY routine_type, routine_name;

SELECT o.trade_name AS empresa,
       academic.fn_resultado_financeiro(
           o.id, DATE '2026-09-01', DATE '2026-09-30'
       ) AS resultado_setembro
FROM public.organizations_organization o
WHERE o.cnpj = '48510276000162';

SELECT academic.fn_resumo_financeiro_formatado(
           o.id, DATE '2026-09-01'
       ) AS resumo
FROM public.organizations_organization o
WHERE o.cnpj = '48510276000162';

SELECT to_char(m.mes, 'MM/YYYY') AS mes,
       academic.fn_resultado_financeiro(
           o.id, m.mes::date, (m.mes + INTERVAL '1 month' - INTERVAL '1 day')::date
       ) AS resultado
FROM public.organizations_organization o
CROSS JOIN generate_series(
    DATE '2026-03-01', DATE '2026-09-01', INTERVAL '1 month'
) AS m(mes)
WHERE o.cnpj = '48510276000162'
ORDER BY m.mes;

BEGIN;

DO $demo$
DECLARE
    v_empresa_id uuid;
BEGIN
    SELECT id INTO STRICT v_empresa_id
    FROM public.organizations_organization
    WHERE cnpj = '48510276000162';

    CALL academic.sp_gerar_alertas_vencimentos(v_empresa_id, DATE '2026-10-04');
    CALL academic.sp_gerar_alertas_vencimentos(v_empresa_id, DATE '2026-10-04');
    CALL academic.sp_gerar_fechamento_mensal(v_empresa_id, DATE '2026-09-01');
    CALL academic.sp_gerar_fechamento_mensal(v_empresa_id, DATE '2026-09-15');
END;
$demo$;

SELECT p.description AS conta, a.priority AS prioridade,
       a.payload ->> 'days_overdue' AS dias_atraso, a.message AS mensagem
FROM public.notifications_alert a
JOIN public.organizations_organization o ON o.id = a.organization_id
JOIN public.finance_payable p ON p.id = a.source_entity_id
WHERE o.cnpj = '48510276000162'
  AND a.source_entity = 'finance_payable'
  AND a.payload ->> 'origin' = 'academic.sp_gerar_alertas_vencimentos'
  AND a.resolved_at IS NULL
ORDER BY p.due_date, p.id;

SELECT COUNT(*) AS alertas_abertos,
       COUNT(DISTINCT a.source_entity_id) AS contas_distintas,
       COUNT(*) = COUNT(DISTINCT a.source_entity_id) AS sem_duplicacao
FROM public.notifications_alert a
JOIN public.organizations_organization o ON o.id = a.organization_id
WHERE o.cnpj = '48510276000162'
  AND a.source_entity = 'finance_payable'
  AND a.payload ->> 'origin' = 'academic.sp_gerar_alertas_vencimentos'
  AND a.resolved_at IS NULL;

SELECT o.trade_name AS empresa, f.mes_referencia,
       f.total_receitas, f.total_despesas, f.resultado
FROM academic.fechamento_mensal f
JOIN public.organizations_organization o ON o.id = f.organization_id
WHERE o.cnpj = '48510276000162'
  AND f.mes_referencia = DATE '2026-09-01';

ROLLBACK;
