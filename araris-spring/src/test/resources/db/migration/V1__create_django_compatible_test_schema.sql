create table accounts_user (
    password varchar(128) not null,
    last_login timestamp with time zone,
    is_superuser boolean not null default false,
    username varchar(150) not null unique,
    first_name varchar(150) not null default '',
    last_name varchar(150) not null default '',
    is_staff boolean not null default false,
    is_active boolean not null default true,
    date_joined timestamp with time zone not null,
    id uuid primary key,
    email varchar(254) not null unique,
    phone varchar(20) not null default '',
    auth_provider varchar(20) not null default 'local',
    google_id varchar(255) not null default '',
    lgpd_consent_given boolean not null default false,
    lgpd_consented_at timestamp with time zone
);

create table organizations_organization (
    id uuid primary key,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    business_name varchar(255) not null,
    cnpj varchar(14) not null unique,
    business_category varchar(30) not null default '',
    postal_code varchar(8) not null default '',
    street varchar(255) not null default '',
    number varchar(30) not null default '',
    address_complement varchar(120) not null default '',
    neighborhood varchar(120) not null default '',
    city varchar(120) not null default '',
    state varchar(2) not null default '',
    ibge_code varchar(20) not null default '',
    initial_balance numeric(12, 2) not null default 0,
    status varchar(20) not null default 'active',
    timezone varchar(64) not null default 'America/Sao_Paulo',
    created_by_id uuid not null references accounts_user(id),
    cnae_code varchar(20) not null default '',
    cnae_description varchar(255) not null default '',
    mei_opt_in boolean,
    registration_status varchar(40) not null default '',
    trade_name varchar(255) not null default ''
);

create table organizations_membership (
    id uuid primary key,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    invite_email varchar(254) not null,
    role varchar(20) not null,
    status varchar(20) not null,
    invite_token varchar(255) unique,
    invited_at timestamp with time zone not null,
    expires_at timestamp with time zone,
    accepted_at timestamp with time zone,
    deactivated_at timestamp with time zone,
    last_access_at timestamp with time zone,
    invited_by_id uuid references accounts_user(id),
    user_id uuid references accounts_user(id),
    organization_id uuid not null references organizations_organization(id) on delete cascade
);

create index test_membership_user_status_idx on organizations_membership(user_id, status);

create table finance_customer (
    id uuid primary key,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    name varchar(255) not null,
    document varchar(14) not null default '',
    email varchar(254) not null default '',
    phone varchar(20) not null default '',
    notes text not null default '',
    is_active boolean not null default true,
    created_by_id uuid references accounts_user(id),
    organization_id uuid not null references organizations_organization(id) on delete cascade
);

create table finance_supplier (
    id uuid primary key,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    name varchar(255) not null,
    document varchar(14) not null default '',
    email varchar(254) not null default '',
    phone varchar(20) not null default '',
    notes text not null default '',
    is_active boolean not null default true,
    created_by_id uuid references accounts_user(id),
    organization_id uuid not null references organizations_organization(id) on delete cascade
);

create table finance_revenue (
    id uuid primary key,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    description varchar(255) not null,
    amount numeric(12, 2) not null,
    occurred_on date not null,
    category varchar(30) not null,
    payment_method varchar(30) not null,
    notes text not null default '',
    created_by_id uuid references accounts_user(id),
    organization_id uuid not null references organizations_organization(id) on delete cascade,
    source_receivable_id uuid,
    customer_id uuid references finance_customer(id),
    constraint test_finance_revenue_amount_positive check (amount > 0)
);

create table finance_expense (
    id uuid primary key,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    description varchar(255) not null,
    amount numeric(12, 2) not null,
    occurred_on date not null,
    category varchar(30) not null,
    payment_method varchar(30) not null,
    notes text not null default '',
    created_by_id uuid references accounts_user(id),
    organization_id uuid not null references organizations_organization(id) on delete cascade,
    source_payable_id uuid,
    supplier_id uuid references finance_supplier(id),
    constraint test_finance_expense_amount_positive check (amount > 0)
);
