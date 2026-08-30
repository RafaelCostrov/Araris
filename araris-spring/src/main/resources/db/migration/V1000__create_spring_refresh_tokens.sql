create table spring_refresh_tokens (
    id uuid primary key,
    user_id uuid not null references accounts_user(id) on delete cascade,
    token_hash varchar(64) not null unique,
    expires_at timestamp with time zone not null,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index spring_refresh_tokens_user_idx on spring_refresh_tokens(user_id);
create index spring_refresh_tokens_expires_at_idx on spring_refresh_tokens(expires_at);
