BEGIN;

CREATE SCHEMA IF NOT EXISTS academic;

CREATE TABLE IF NOT EXISTS academic.fechamento_mensal (
    organization_id uuid NOT NULL
        REFERENCES public.organizations_organization(id) ON DELETE CASCADE,
    mes_referencia date NOT NULL,
    total_receitas numeric NOT NULL CHECK (total_receitas >= 0),
    total_despesas numeric NOT NULL CHECK (total_despesas >= 0),
    resultado numeric NOT NULL,
    gerado_em timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, mes_referencia),
    CHECK (isfinite(mes_referencia) AND EXTRACT(DAY FROM mes_referencia) = 1),
    CHECK (resultado = total_receitas - total_despesas)
);

CREATE OR REPLACE FUNCTION academic.fn_resultado_financeiro(
    IN p_organization_id uuid,
    IN p_data_inicio date,
    IN p_data_fim date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
    v_empresa_id uuid;
    v_resultado numeric;
BEGIN
    IF p_organization_id IS NULL
       OR p_data_inicio IS NULL
       OR p_data_fim IS NULL
       OR NOT isfinite(p_data_inicio)
       OR NOT isfinite(p_data_fim)
       OR p_data_fim < p_data_inicio THEN
        RAISE EXCEPTION 'Informe a empresa e um intervalo de datas válido.'
            USING ERRCODE = '22023';
    END IF;

    SELECT id INTO STRICT v_empresa_id
    FROM public.organizations_organization
    WHERE id = p_organization_id;

    SELECT COALESCE(SUM(valor), 0)
    INTO v_resultado
    FROM (
        SELECT amount AS valor
        FROM public.finance_revenue
        WHERE organization_id = p_organization_id
          AND occurred_on BETWEEN p_data_inicio AND p_data_fim
        UNION ALL
        SELECT -amount
        FROM public.finance_expense
        WHERE organization_id = p_organization_id
          AND occurred_on BETWEEN p_data_inicio AND p_data_fim
    ) AS movimentos;

    RETURN ROUND(v_resultado, 2);
EXCEPTION
    WHEN no_data_found THEN
        RAISE EXCEPTION 'Empresa não encontrada para calcular o resultado.'
            USING ERRCODE = 'P0002';
    WHEN numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Valor financeiro fora do intervalo numérico permitido.'
            USING ERRCODE = '22003';
END;
$function$;

CREATE OR REPLACE FUNCTION academic.fn_resumo_financeiro_formatado(
    IN p_organization_id uuid,
    IN p_mes date
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
    v_empresa text;
    v_inicio date;
    v_fim date;
    v_resultado numeric;
    v_situacao text;
BEGIN
    IF p_organization_id IS NULL OR p_mes IS NULL OR NOT isfinite(p_mes) THEN
        RAISE EXCEPTION 'Informe a empresa e um mês válido.'
            USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(NULLIF(trade_name, ''), business_name)
    INTO STRICT v_empresa
    FROM public.organizations_organization
    WHERE id = p_organization_id;

    v_inicio := date_trunc('month', p_mes)::date;
    v_fim := (v_inicio + INTERVAL '1 month' - INTERVAL '1 day')::date;
    v_resultado := academic.fn_resultado_financeiro(
        p_organization_id, v_inicio, v_fim
    );

    IF v_resultado > 0 THEN
        v_situacao := 'Superávit';
    ELSIF v_resultado < 0 THEN
        v_situacao := 'Déficit';
    ELSE
        v_situacao := 'Equilíbrio';
    END IF;

    RETURN format(
        '%s | Período: %s | Resultado: R$ %s | Situação: %s',
        v_empresa,
        to_char(v_inicio, 'MM/YYYY'),
        replace(v_resultado::text, '.', ','),
        v_situacao
    );
EXCEPTION
    WHEN no_data_found THEN
        RAISE EXCEPTION 'Empresa não encontrada para gerar o resumo.'
            USING ERRCODE = 'P0002';
    WHEN datetime_field_overflow THEN
        RAISE EXCEPTION 'O mês informado está fora do intervalo de datas permitido.'
            USING ERRCODE = '22008';
END;
$function$;

CREATE OR REPLACE PROCEDURE academic.sp_gerar_alertas_vencimentos(
    IN p_organization_id uuid,
    IN p_data_referencia date DEFAULT CURRENT_DATE
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $procedure$
DECLARE
    v_empresa_id uuid;
    v_dias_atraso integer;
    v_prioridade text;
    v_mensagem text;
    v_payload jsonb;
    c_contas CURSOR FOR
        SELECT p.id, p.description, p.amount, p.due_date
        FROM public.finance_payable p
        WHERE p.organization_id = p_organization_id
          AND p.status = 'pending'
          AND p.due_date < p_data_referencia
          AND NOT EXISTS (
              SELECT 1 FROM public.finance_expense e
              WHERE e.source_payable_id = p.id
          )
        ORDER BY p.due_date, p.id
        FOR UPDATE OF p;
BEGIN
    IF p_organization_id IS NULL
       OR p_data_referencia IS NULL
       OR NOT isfinite(p_data_referencia) THEN
        RAISE EXCEPTION 'Informe a empresa e uma data de referência válida.'
            USING ERRCODE = '22023';
    END IF;

    SELECT id INTO STRICT v_empresa_id
    FROM public.organizations_organization
    WHERE id = p_organization_id
    FOR NO KEY UPDATE;

    UPDATE public.notifications_alert a
    SET resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE a.organization_id = p_organization_id
      AND a.type = 'overdue_bill'
      AND a.source_entity = 'finance_payable'
      AND a.payload ->> 'origin' = 'academic.sp_gerar_alertas_vencimentos'
      AND a.resolved_at IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM public.finance_payable p
          WHERE p.id = a.source_entity_id
            AND p.organization_id = p_organization_id
            AND p.status = 'pending'
            AND p.due_date < p_data_referencia
            AND NOT EXISTS (
                SELECT 1 FROM public.finance_expense e
                WHERE e.source_payable_id = p.id
            )
      );

    FOR v_conta IN c_contas LOOP
        v_dias_atraso := p_data_referencia - v_conta.due_date;

        IF v_dias_atraso >= 30 THEN
            v_prioridade := 'critical';
        ELSE
            v_prioridade := 'high';
        END IF;

        v_mensagem := format(
            'A conta "%s", no valor de R$ %s, venceu em %s e está atrasada há %s dia(s).',
            v_conta.description,
            replace(v_conta.amount::text, '.', ','),
            to_char(v_conta.due_date, 'DD/MM/YYYY'),
            v_dias_atraso
        );
        v_payload := jsonb_build_object(
            'origin', 'academic.sp_gerar_alertas_vencimentos',
            'reference_date', p_data_referencia,
            'days_overdue', v_dias_atraso,
            'amount', v_conta.amount
        );

        UPDATE public.notifications_alert
        SET message = v_mensagem,
            priority = v_prioridade,
            payload = v_payload,
            updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = p_organization_id
          AND type = 'overdue_bill'
          AND source_entity = 'finance_payable'
          AND source_entity_id = v_conta.id
          AND payload ->> 'origin' = 'academic.sp_gerar_alertas_vencimentos'
          AND resolved_at IS NULL;

        IF NOT FOUND THEN
            INSERT INTO public.notifications_alert (
                id, created_at, updated_at, organization_id,
                type, title, message, priority, source_entity,
                source_entity_id, payload, resolved_at
            ) VALUES (
                gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                p_organization_id, 'overdue_bill', 'Conta vencida',
                v_mensagem, v_prioridade, 'finance_payable',
                v_conta.id, v_payload, NULL
            );
        END IF;
    END LOOP;
EXCEPTION
    WHEN no_data_found THEN
        RAISE EXCEPTION 'Empresa não encontrada para gerar alertas.'
            USING ERRCODE = 'P0002';
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Não foi possível associar o alerta à empresa.'
            USING ERRCODE = '23503';
END;
$procedure$;

CREATE OR REPLACE PROCEDURE academic.sp_gerar_fechamento_mensal(
    IN p_organization_id uuid,
    IN p_mes date
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $procedure$
DECLARE
    v_empresa_id uuid;
    v_inicio date;
    v_proximo_mes date;
    v_receitas numeric;
    v_despesas numeric;
    v_resultado numeric;
BEGIN
    IF p_organization_id IS NULL OR p_mes IS NULL OR NOT isfinite(p_mes) THEN
        RAISE EXCEPTION 'Informe a empresa e um mês válido para o fechamento.'
            USING ERRCODE = '22023';
    END IF;

    SELECT id INTO STRICT v_empresa_id
    FROM public.organizations_organization
    WHERE id = p_organization_id
    FOR NO KEY UPDATE;

    v_inicio := date_trunc('month', p_mes)::date;
    v_proximo_mes := (v_inicio + INTERVAL '1 month')::date;

    SELECT COALESCE(SUM(entrada), 0),
           COALESCE(SUM(saida), 0),
           academic.fn_resultado_financeiro(
               p_organization_id, v_inicio, v_proximo_mes - 1
           )
    INTO v_receitas, v_despesas, v_resultado
    FROM (
        SELECT amount AS entrada, 0::numeric AS saida
        FROM public.finance_revenue
        WHERE organization_id = p_organization_id
          AND occurred_on >= v_inicio AND occurred_on < v_proximo_mes
        UNION ALL
        SELECT 0::numeric, amount
        FROM public.finance_expense
        WHERE organization_id = p_organization_id
          AND occurred_on >= v_inicio AND occurred_on < v_proximo_mes
    ) AS movimentos;

    INSERT INTO academic.fechamento_mensal (
        organization_id, mes_referencia,
        total_receitas, total_despesas, resultado, gerado_em
    ) VALUES (
        p_organization_id, v_inicio,
        v_receitas, v_despesas, v_resultado, CURRENT_TIMESTAMP
    )
    ON CONFLICT (organization_id, mes_referencia)
    DO UPDATE SET
        total_receitas = EXCLUDED.total_receitas,
        total_despesas = EXCLUDED.total_despesas,
        resultado = EXCLUDED.resultado,
        gerado_em = EXCLUDED.gerado_em;
EXCEPTION
    WHEN no_data_found THEN
        RAISE EXCEPTION 'Empresa não encontrada para gerar o fechamento.'
            USING ERRCODE = 'P0002';
    WHEN datetime_field_overflow THEN
        RAISE EXCEPTION 'O mês informado está fora do intervalo de datas permitido.'
            USING ERRCODE = '22008';
    WHEN check_violation THEN
        RAISE EXCEPTION 'Os totais do fechamento não são consistentes.'
            USING ERRCODE = '23514';
END;
$procedure$;

COMMIT;
