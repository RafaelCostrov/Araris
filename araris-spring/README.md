# Araris Smart HAS — API acadêmica em Spring Boot

> A API Spring é paralela ao backend Django e não representa uma migração tecnológica do produto. Para a demonstração, porém, os dois backends usam o mesmo PostgreSQL e as mesmas tabelas de usuários, empresas, clientes, fornecedores, entradas e saídas.

As migrações e o schema de negócio continuam sob responsabilidade do Django. O Spring apenas mapeia essas tabelas com JPA e cria duas estruturas auxiliares no mesmo banco:

- `spring_refresh_tokens`, usada exclusivamente nas sessões emitidas pelo Spring;
- `flyway_schema_history`, usada para controlar somente as migrações auxiliares Spring.

## Escopo demonstrado

- cadastro por e-mail com criação transacional de usuário e empresa;
- login, access token JWT, refresh token opaco armazenado como hash e rotação do refresh;
- consulta e atualização do perfil autenticado;
- consulta e atualização da empresa do usuário;
- verificação de disponibilidade de e-mail e CNPJ;
- CRUD de clientes e fornecedores, com desativação lógica;
- CRUD de entradas e saídas financeiras;
- resumo financeiro mensal compatível com a tela Home do aplicativo;
- autorização por perfil e isolamento dos dados por empresa;
- documentação OpenAPI/Swagger;
- página institucional simples renderizada com Thymeleaf;
- migrações versionadas com Flyway e banco PostgreSQL;
- testes de integração com JUnit, MockMvc e H2 em modo PostgreSQL.

O recorte foi escolhido porque forma um fluxo completo: o usuário se cadastra, autentica-se, administra contatos e lançamentos e consulta os resultados no resumo mensal.

## Tecnologias

- Java 21;
- Spring Boot 4.1;
- Spring MVC e Thymeleaf;
- Spring Security e OAuth2 Resource Server para validação JWT;
- Spring Data JPA/Hibernate;
- PostgreSQL e Flyway;
- springdoc-openapi/Swagger UI;
- JUnit, MockMvc, Spring Security Test e H2.

## Arquitetura

O código está separado por domínio e responsabilidade:

```text
src/main/java/com/araris/smarthas
├── auth          # controllers, DTOs, models, repositories e serviços de acesso
├── common        # entidades-base e tratamento global de erros
├── config        # JWT, CORS, autorização e OpenAPI
├── finance       # contatos, lançamentos e resumo mensal
├── organization  # empresa e isolamento dos dados
└── web           # página Thymeleaf
```

Controllers recebem e devolvem DTOs, Services concentram regras de negócio e transações, Repositories encapsulam a persistência e Models representam as entidades JPA.

## Executar localmente

Pré-requisitos:

- Java 21;
- o PostgreSQL usado pelo Django em execução;
- migrações Django aplicadas.

O Spring lê automaticamente as credenciais de `../araris-back/.env`. Primeiro confirme o Django e depois inicie a API Spring:

```bash
cd ../araris-back
.venv/bin/python manage.py migrate

cd ../araris-spring
./gradlew bootRun
```

Se o arquivo do Django não estiver disponível, configure as mesmas variáveis manualmente:

```bash
export POSTGRES_DB='araris'
export POSTGRES_USER='postgres'
export POSTGRES_PASSWORD='mesma-senha-usada-pelo-django'
export POSTGRES_HOST='localhost'
export POSTGRES_PORT='5432'
export SERVER_PORT='8080'
export ARARIS_JWT_SECRET='SEGREDO_BASE64_COM_PELO_MENOS_32_BYTES'
export CORS_ALLOWED_ORIGINS='http://localhost:4200,http://localhost:8081'
```

Gere um segredo adequado com `openssl rand -base64 32`. O segredo padrão presente na configuração serve somente para desenvolvimento local.

Após iniciar:

- página Thymeleaf: `http://localhost:8080/`;
- Swagger UI: `http://localhost:8080/swagger-ui.html`;
- especificação OpenAPI: `http://localhost:8080/v3/api-docs`;
- health check: `http://localhost:8080/actuator/health`.

## Integração temporária com o React Native

O formato dos principais endpoints foi mantido próximo ao contrato atual do DRF. Para uma demonstração no emulador Android, o aplicativo pode ser iniciado com:

```bash
cd ../araris-front
EXPO_PUBLIC_API_URL_ANDROID='http://10.0.2.2:8080/api' npx expo start
```

Em aparelho físico, substitua `10.0.2.2` pelo IP do computador na rede local. O recorte Spring atende o cadastro por e-mail, login, sessão, Home, entradas/saídas e clientes/fornecedores. As demais telas continuam pertencendo exclusivamente ao backend Django e ficam fora da navegação usada na demonstração Spring.

Também é possível selecionar o backend por plataforma no arquivo ignorado `araris-front/.env`, sem alterar o código:

```dotenv
EXPO_PUBLIC_API_URL_ANDROID=http://10.0.2.2:8080/api
EXPO_PUBLIC_API_URL_IOS=http://127.0.0.1:8080/api
```

`127.0.0.1` funciona no simulador iOS. Em um iPhone físico, use o IP do Mac na mesma rede local, por exemplo `http://192.168.1.10:8080/api`. Reinicie o Metro após qualquer alteração no `.env`.

Não é necessário desativar nem excluir endpoints do DRF: a seleção do backend ocorre pela URL configurada no aplicativo.

Os usuários locais já cadastrados pelo Django podem entrar pelo Spring porque ambos usam o formato `pbkdf2_sha256`. Usuários criados pelo Spring também podem autenticar no Django. Contas cadastradas exclusivamente com Google possuem senha inutilizável e continuam dependendo do endpoint Google do DRF.

Embora os dados sejam compartilhados, os JWTs não são: um access token emitido pelo Spring deve ser usado nos endpoints Spring, e um token do Simple JWT deve ser usado no DRF.

## Endpoints principais

| Método | Caminho | Finalidade |
| --- | --- | --- |
| `POST` | `/api/accounts/register/` | Cadastrar usuário e empresa |
| `POST` | `/api/accounts/login/` | Autenticar por e-mail e senha |
| `POST` | `/api/accounts/token/refresh/` | Rotacionar a sessão |
| `GET/PATCH` | `/api/accounts/me/` | Consultar ou atualizar o perfil |
| `GET` | `/api/accounts/check-email/` | Verificar disponibilidade do e-mail |
| `GET` | `/api/organizations/check-cnpj/` | Verificar disponibilidade do CNPJ |
| `GET/PATCH` | `/api/organizations/current/` | Consultar ou atualizar a empresa |
| `GET/POST` | `/api/finance/customers/` | Listar ou cadastrar clientes |
| `PATCH/DELETE` | `/api/finance/customers/{id}/` | Atualizar ou desativar cliente |
| `GET/POST` | `/api/finance/suppliers/` | Listar ou cadastrar fornecedores |
| `PATCH/DELETE` | `/api/finance/suppliers/{id}/` | Atualizar ou desativar fornecedor |
| `GET/POST` | `/api/finance/revenues/` | Listar ou cadastrar entradas |
| `PATCH/DELETE` | `/api/finance/revenues/{id}/` | Atualizar ou remover entrada |
| `GET/POST` | `/api/finance/expenses/` | Listar ou cadastrar saídas |
| `PATCH/DELETE` | `/api/finance/expenses/{id}/` | Atualizar ou remover saída |
| `GET` | `/api/finance/summary/` | Consultar resumo mensal |

Os endpoints privados recebem `Authorization: Bearer <access-token>`. O Swagger permite informar esse token no botão **Authorize**.

## Segurança e autorização

- senhas em `pbkdf2_sha256`, com um milhão de iterações, compatíveis com o Django 5.2 do projeto;
- access token JWT assinado com HMAC-SHA256 e validade curta;
- refresh token aleatório armazenado apenas como hash SHA-256;
- rotação do refresh token após cada uso;
- API stateless, sem sessão HTTP;
- CORS restrito às origens configuradas;
- endpoints protegidos por autenticação;
- consultas filtradas pelo usuário proprietário da empresa;
- respostas `404` ao tentar acessar recursos de outra empresa, evitando exposição de existência;
- segredos e credenciais configuráveis por variáveis de ambiente.

O Hibernate está configurado com `ddl-auto: validate`: ele valida o mapeamento, mas não cria nem altera tabelas Django. O Flyway usa baseline no schema preexistente e executa somente migrações localizadas no módulo Spring.

Em uma publicação real, o serviço também deve ser colocado atrás de HTTPS. HTTP é utilizado apenas no ambiente local e no emulador.

## Validação e erros

Bean Validation protege os DTOs de entrada, enquanto regras dependentes do domínio são validadas nos Services. Erros são tratados centralmente por `GlobalExceptionHandler` e seguem uma estrutura previsível:

```json
{
  "detail": "O valor deve ser maior que zero.",
  "status": 400,
  "path": "/api/finance/expenses/",
  "timestamp": "2026-08-30T15:00:00Z",
  "errors": {
    "amount": "O valor deve ser maior que zero."
  }
}
```

## Testes

Execute:

```bash
./gradlew test
```

A suíte cobre:

- rejeição de acesso anônimo;
- cadastro, consulta de sessão e atualização de perfil;
- rotação e invalidação de refresh tokens;
- e-mail duplicado e confirmação de senha inválida;
- CRUD financeiro e cálculo do resumo;
- CRUD de cliente e vínculo com uma entrada;
- isolamento de dados entre empresas;
- disponibilidade da página Thymeleaf e da especificação OpenAPI.
- compatibilidade com um hash PBKDF2 gerado pelo Django.

O perfil de teste usa H2 em modo PostgreSQL. Uma migração disponível somente nos testes reproduz as tabelas Django necessárias; a migração de produção contém exclusivamente `spring_refresh_tokens`.

## Cuidados com o banco compartilhado

- execute `manage.py migrate` antes de iniciar o Spring;
- não use `ddl-auto=create`, `update` ou `create-drop` contra esse banco;
- alterações estruturais das tabelas de negócio devem ser feitas por migrations Django;
- não remova `flyway_schema_history` ou `spring_refresh_tokens` enquanto houver sessões Spring ativas;
- para a apresentação, prefira uma conta de demonstração ou um backup recente do banco.

## Limites intencionais

Para manter a entrega acadêmica separada do produto principal, esta API não implementa login Google, compromissos a pagar/receber, dashboard analítico, chatbot, notificações ou regras tributárias. Essas funcionalidades continuam no Django e não estão planejadas para migração ao Spring.
