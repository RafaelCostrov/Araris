\restrict yZfHIW3c8BPSsBBrsQjbQ2XalhgFyis6uWDNflJ2OYoHYpO4foZSTGDfhxh0p9n

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.accounts_user (
    password character varying(128) NOT NULL,
    last_login timestamp with time zone,
    is_superuser boolean NOT NULL,
    username character varying(150) NOT NULL,
    first_name character varying(150) NOT NULL,
    last_name character varying(150) NOT NULL,
    is_staff boolean NOT NULL,
    is_active boolean NOT NULL,
    date_joined timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    email character varying(254) NOT NULL,
    phone character varying(20) NOT NULL,
    auth_provider character varying(20) NOT NULL,
    google_id character varying(255) NOT NULL,
    lgpd_consent_given boolean NOT NULL,
    lgpd_consented_at timestamp with time zone
);

CREATE TABLE public.finance_customer (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    name character varying(255) NOT NULL,
    document character varying(14) NOT NULL,
    email character varying(254) NOT NULL,
    phone character varying(20) NOT NULL,
    notes text NOT NULL,
    is_active boolean NOT NULL,
    created_by_id uuid,
    organization_id uuid NOT NULL
);

CREATE TABLE public.finance_expense (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    description character varying(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    occurred_on date NOT NULL,
    category character varying(30) NOT NULL,
    payment_method character varying(30) NOT NULL,
    notes text NOT NULL,
    created_by_id uuid,
    organization_id uuid NOT NULL,
    source_payable_id uuid,
    supplier_id uuid,
    CONSTRAINT finance_expense_amount_positive CHECK ((amount > (0)::numeric))
);

CREATE TABLE public.finance_payable (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    description character varying(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    due_date date NOT NULL,
    paid_at date,
    status character varying(20) NOT NULL,
    category character varying(30) NOT NULL,
    payment_method character varying(30) NOT NULL,
    notes text NOT NULL,
    created_by_id uuid,
    organization_id uuid NOT NULL,
    recurrence character varying(20) NOT NULL,
    recurrence_group uuid,
    recurrence_sequence smallint NOT NULL,
    recurrence_total smallint NOT NULL,
    recurrence_indefinite boolean NOT NULL,
    supplier_id uuid,
    CONSTRAINT finance_payable_amount_positive CHECK ((amount > (0)::numeric)),
    CONSTRAINT finance_payable_recurrence_sequence_check CHECK ((recurrence_sequence >= 0)),
    CONSTRAINT finance_payable_recurrence_total_check CHECK ((recurrence_total >= 0))
);

CREATE TABLE public.finance_receivable (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    description character varying(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    due_date date NOT NULL,
    received_at date,
    status character varying(20) NOT NULL,
    category character varying(30) NOT NULL,
    payment_method character varying(30) NOT NULL,
    notes text NOT NULL,
    created_by_id uuid,
    organization_id uuid NOT NULL,
    recurrence character varying(20) NOT NULL,
    recurrence_group uuid,
    recurrence_sequence smallint NOT NULL,
    recurrence_total smallint NOT NULL,
    recurrence_indefinite boolean NOT NULL,
    customer_id uuid,
    CONSTRAINT finance_receivable_amount_positive CHECK ((amount > (0)::numeric)),
    CONSTRAINT finance_receivable_recurrence_sequence_check CHECK ((recurrence_sequence >= 0)),
    CONSTRAINT finance_receivable_recurrence_total_check CHECK ((recurrence_total >= 0))
);

CREATE TABLE public.finance_revenue (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    description character varying(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    occurred_on date NOT NULL,
    category character varying(30) NOT NULL,
    payment_method character varying(30) NOT NULL,
    notes text NOT NULL,
    created_by_id uuid,
    organization_id uuid NOT NULL,
    source_receivable_id uuid,
    customer_id uuid,
    CONSTRAINT finance_revenue_amount_positive CHECK ((amount > (0)::numeric))
);

CREATE TABLE public.finance_supplier (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    name character varying(255) NOT NULL,
    document character varying(14) NOT NULL,
    email character varying(254) NOT NULL,
    phone character varying(20) NOT NULL,
    notes text NOT NULL,
    is_active boolean NOT NULL,
    created_by_id uuid,
    organization_id uuid NOT NULL
);

CREATE TABLE public.notifications_alert (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    type character varying(40) NOT NULL,
    title character varying(160) NOT NULL,
    message text NOT NULL,
    priority character varying(20) NOT NULL,
    source_entity character varying(100) NOT NULL,
    source_entity_id uuid,
    payload jsonb NOT NULL,
    resolved_at timestamp with time zone,
    organization_id uuid NOT NULL
);

CREATE TABLE public.organizations_membership (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    invite_email character varying(254) NOT NULL,
    role character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    invite_token character varying(255),
    invited_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone,
    accepted_at timestamp with time zone,
    deactivated_at timestamp with time zone,
    last_access_at timestamp with time zone,
    invited_by_id uuid,
    user_id uuid,
    organization_id uuid NOT NULL
);

CREATE TABLE public.organizations_organization (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    business_name character varying(255) NOT NULL,
    cnpj character varying(14) NOT NULL,
    business_category character varying(30) NOT NULL,
    postal_code character varying(8) NOT NULL,
    street character varying(255) NOT NULL,
    number character varying(30) NOT NULL,
    address_complement character varying(120) NOT NULL,
    neighborhood character varying(120) NOT NULL,
    city character varying(120) NOT NULL,
    state character varying(2) NOT NULL,
    ibge_code character varying(20) NOT NULL,
    initial_balance numeric(12,2) NOT NULL,
    status character varying(20) NOT NULL,
    timezone character varying(64) NOT NULL,
    created_by_id uuid NOT NULL,
    cnae_code character varying(20) NOT NULL,
    cnae_description character varying(255) NOT NULL,
    mei_opt_in boolean,
    registration_status character varying(40) NOT NULL,
    trade_name character varying(255) NOT NULL
);

ALTER TABLE ONLY public.accounts_user
    ADD CONSTRAINT accounts_user_email_key UNIQUE (email);

ALTER TABLE ONLY public.accounts_user
    ADD CONSTRAINT accounts_user_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accounts_user
    ADD CONSTRAINT accounts_user_username_key UNIQUE (username);

ALTER TABLE ONLY public.finance_customer
    ADD CONSTRAINT finance_customer_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finance_expense
    ADD CONSTRAINT finance_expense_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finance_expense
    ADD CONSTRAINT finance_expense_source_payable_id_key UNIQUE (source_payable_id);

ALTER TABLE ONLY public.finance_payable
    ADD CONSTRAINT finance_payable_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finance_receivable
    ADD CONSTRAINT finance_receivable_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finance_revenue
    ADD CONSTRAINT finance_revenue_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finance_revenue
    ADD CONSTRAINT finance_revenue_source_receivable_id_key UNIQUE (source_receivable_id);

ALTER TABLE ONLY public.finance_supplier
    ADD CONSTRAINT finance_supplier_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications_alert
    ADD CONSTRAINT notifications_alert_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.organizations_membership
    ADD CONSTRAINT organizations_membership_invite_token_key UNIQUE (invite_token);

ALTER TABLE ONLY public.organizations_membership
    ADD CONSTRAINT organizations_membership_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.organizations_organization
    ADD CONSTRAINT organizations_organization_cnpj_key UNIQUE (cnpj);

ALTER TABLE ONLY public.organizations_organization
    ADD CONSTRAINT organizations_organization_pkey PRIMARY KEY (id);

CREATE INDEX accounts_user_email_b2644a56_like ON public.accounts_user USING btree (email varchar_pattern_ops);

CREATE INDEX accounts_user_username_6088629e_like ON public.accounts_user USING btree (username varchar_pattern_ops);

CREATE INDEX finance_cus_organiz_2114c4_idx ON public.finance_customer USING btree (organization_id, document);

CREATE INDEX finance_cus_organiz_56c6ee_idx ON public.finance_customer USING btree (organization_id, is_active, name);

CREATE INDEX finance_customer_created_by_id_3596c0bc ON public.finance_customer USING btree (created_by_id);

CREATE INDEX finance_customer_organization_id_16bfaeb5 ON public.finance_customer USING btree (organization_id);

CREATE UNIQUE INDEX finance_customer_unique_document_per_org ON public.finance_customer USING btree (organization_id, document) WHERE (NOT ((document)::text = ''::text));

CREATE INDEX finance_exp_organiz_6173f4_idx ON public.finance_expense USING btree (organization_id, category);

CREATE INDEX finance_exp_organiz_64634b_idx ON public.finance_expense USING btree (organization_id, occurred_on);

CREATE INDEX finance_expense_created_by_id_913042dd ON public.finance_expense USING btree (created_by_id);

CREATE INDEX finance_expense_organization_id_12584951 ON public.finance_expense USING btree (organization_id);

CREATE INDEX finance_expense_supplier_id_be5267a8 ON public.finance_expense USING btree (supplier_id);

CREATE INDEX finance_pay_organiz_04a51e_idx ON public.finance_payable USING btree (organization_id, category);

CREATE INDEX finance_pay_organiz_e64b8f_idx ON public.finance_payable USING btree (organization_id, status, due_date);

CREATE INDEX finance_payable_created_by_id_c0e33141 ON public.finance_payable USING btree (created_by_id);

CREATE INDEX finance_payable_organization_id_5b2b8f9a ON public.finance_payable USING btree (organization_id);

CREATE INDEX finance_payable_recurrence_group_3f1c48f3 ON public.finance_payable USING btree (recurrence_group);

CREATE INDEX finance_payable_supplier_id_09ae4bc1 ON public.finance_payable USING btree (supplier_id);

CREATE INDEX finance_rec_organiz_90601d_idx ON public.finance_receivable USING btree (organization_id, category);

CREATE INDEX finance_rec_organiz_e750eb_idx ON public.finance_receivable USING btree (organization_id, status, due_date);

CREATE INDEX finance_receivable_created_by_id_b94495a9 ON public.finance_receivable USING btree (created_by_id);

CREATE INDEX finance_receivable_customer_id_fee789b3 ON public.finance_receivable USING btree (customer_id);

CREATE INDEX finance_receivable_organization_id_94ff8c42 ON public.finance_receivable USING btree (organization_id);

CREATE INDEX finance_receivable_recurrence_group_2ccdb41f ON public.finance_receivable USING btree (recurrence_group);

CREATE INDEX finance_rev_organiz_54433d_idx ON public.finance_revenue USING btree (organization_id, category);

CREATE INDEX finance_rev_organiz_9aba29_idx ON public.finance_revenue USING btree (organization_id, occurred_on);

CREATE INDEX finance_revenue_created_by_id_37d1a506 ON public.finance_revenue USING btree (created_by_id);

CREATE INDEX finance_revenue_customer_id_fbfcc9d8 ON public.finance_revenue USING btree (customer_id);

CREATE INDEX finance_revenue_organization_id_4411fb9c ON public.finance_revenue USING btree (organization_id);

CREATE INDEX finance_sup_organiz_b8c651_idx ON public.finance_supplier USING btree (organization_id, is_active, name);

CREATE INDEX finance_sup_organiz_cfa3ff_idx ON public.finance_supplier USING btree (organization_id, document);

CREATE INDEX finance_supplier_created_by_id_31745404 ON public.finance_supplier USING btree (created_by_id);

CREATE INDEX finance_supplier_organization_id_168680f2 ON public.finance_supplier USING btree (organization_id);

CREATE UNIQUE INDEX finance_supplier_unique_document_per_org ON public.finance_supplier USING btree (organization_id, document) WHERE (NOT ((document)::text = ''::text));

CREATE INDEX notificatio_organiz_67373d_idx ON public.notifications_alert USING btree (organization_id, type);

CREATE INDEX notificatio_priorit_a1528c_idx ON public.notifications_alert USING btree (priority, resolved_at);

CREATE INDEX notifications_alert_organization_id_1b6353cf ON public.notifications_alert USING btree (organization_id);

CREATE INDEX organizatio_cnpj_970e63_idx ON public.organizations_organization USING btree (cnpj);

CREATE INDEX organizatio_invite__712398_idx ON public.organizations_membership USING btree (invite_email);

CREATE INDEX organizatio_organiz_c6aad1_idx ON public.organizations_membership USING btree (organization_id, status);

CREATE INDEX organizatio_status_295901_idx ON public.organizations_organization USING btree (status);

CREATE INDEX organizations_membership_invite_token_c4ac8067_like ON public.organizations_membership USING btree (invite_token varchar_pattern_ops);

CREATE INDEX organizations_membership_invited_by_id_85a6302b ON public.organizations_membership USING btree (invited_by_id);

CREATE INDEX organizations_membership_organization_id_6889aa64 ON public.organizations_membership USING btree (organization_id);

CREATE INDEX organizations_membership_user_id_a8e72055 ON public.organizations_membership USING btree (user_id);

CREATE INDEX organizations_organization_cnpj_c33be581_like ON public.organizations_organization USING btree (cnpj varchar_pattern_ops);

CREATE INDEX organizations_organization_created_by_id_fd8f65e6 ON public.organizations_organization USING btree (created_by_id);

CREATE UNIQUE INDEX unique_membership_per_user_organization ON public.organizations_membership USING btree (organization_id, user_id) WHERE (user_id IS NOT NULL);

CREATE UNIQUE INDEX unique_pending_invite_per_email_organization ON public.organizations_membership USING btree (organization_id, invite_email) WHERE ((status)::text = 'invited'::text);

ALTER TABLE ONLY public.finance_customer
    ADD CONSTRAINT finance_customer_created_by_id_3596c0bc_fk_accounts_user_id FOREIGN KEY (created_by_id) REFERENCES public.accounts_user(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_customer
    ADD CONSTRAINT finance_customer_organization_id_16bfaeb5_fk_organizat FOREIGN KEY (organization_id) REFERENCES public.organizations_organization(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_expense
    ADD CONSTRAINT finance_expense_created_by_id_913042dd_fk_accounts_user_id FOREIGN KEY (created_by_id) REFERENCES public.accounts_user(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_expense
    ADD CONSTRAINT finance_expense_organization_id_12584951_fk_organizat FOREIGN KEY (organization_id) REFERENCES public.organizations_organization(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_expense
    ADD CONSTRAINT finance_expense_source_payable_id_bf5d2d88_fk_finance_p FOREIGN KEY (source_payable_id) REFERENCES public.finance_payable(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_expense
    ADD CONSTRAINT finance_expense_supplier_id_be5267a8_fk_finance_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.finance_supplier(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_payable
    ADD CONSTRAINT finance_payable_created_by_id_c0e33141_fk_accounts_user_id FOREIGN KEY (created_by_id) REFERENCES public.accounts_user(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_payable
    ADD CONSTRAINT finance_payable_organization_id_5b2b8f9a_fk_organizat FOREIGN KEY (organization_id) REFERENCES public.organizations_organization(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_payable
    ADD CONSTRAINT finance_payable_supplier_id_09ae4bc1_fk_finance_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.finance_supplier(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_receivable
    ADD CONSTRAINT finance_receivable_created_by_id_b94495a9_fk_accounts_user_id FOREIGN KEY (created_by_id) REFERENCES public.accounts_user(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_receivable
    ADD CONSTRAINT finance_receivable_customer_id_fee789b3_fk_finance_customer_id FOREIGN KEY (customer_id) REFERENCES public.finance_customer(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_receivable
    ADD CONSTRAINT finance_receivable_organization_id_94ff8c42_fk_organizat FOREIGN KEY (organization_id) REFERENCES public.organizations_organization(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_revenue
    ADD CONSTRAINT finance_revenue_created_by_id_37d1a506_fk_accounts_user_id FOREIGN KEY (created_by_id) REFERENCES public.accounts_user(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_revenue
    ADD CONSTRAINT finance_revenue_customer_id_fbfcc9d8_fk_finance_customer_id FOREIGN KEY (customer_id) REFERENCES public.finance_customer(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_revenue
    ADD CONSTRAINT finance_revenue_organization_id_4411fb9c_fk_organizat FOREIGN KEY (organization_id) REFERENCES public.organizations_organization(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_revenue
    ADD CONSTRAINT finance_revenue_source_receivable_id_6b35de40_fk_finance_r FOREIGN KEY (source_receivable_id) REFERENCES public.finance_receivable(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_supplier
    ADD CONSTRAINT finance_supplier_created_by_id_31745404_fk_accounts_user_id FOREIGN KEY (created_by_id) REFERENCES public.accounts_user(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.finance_supplier
    ADD CONSTRAINT finance_supplier_organization_id_168680f2_fk_organizat FOREIGN KEY (organization_id) REFERENCES public.organizations_organization(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.notifications_alert
    ADD CONSTRAINT notifications_alert_organization_id_1b6353cf_fk_organizat FOREIGN KEY (organization_id) REFERENCES public.organizations_organization(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.organizations_membership
    ADD CONSTRAINT organizations_member_invited_by_id_85a6302b_fk_accounts_ FOREIGN KEY (invited_by_id) REFERENCES public.accounts_user(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.organizations_membership
    ADD CONSTRAINT organizations_member_organization_id_6889aa64_fk_organizat FOREIGN KEY (organization_id) REFERENCES public.organizations_organization(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.organizations_membership
    ADD CONSTRAINT organizations_membership_user_id_a8e72055_fk_accounts_user_id FOREIGN KEY (user_id) REFERENCES public.accounts_user(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.organizations_organization
    ADD CONSTRAINT organizations_organi_created_by_id_fd8f65e6_fk_accounts_ FOREIGN KEY (created_by_id) REFERENCES public.accounts_user(id) DEFERRABLE INITIALLY DEFERRED;

\unrestrict yZfHIW3c8BPSsBBrsQjbQ2XalhgFyis6uWDNflJ2OYoHYpO4foZSTGDfhxh0p9n
