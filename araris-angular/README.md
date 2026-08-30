# Araris Admin — painel acadêmico em Angular

> Este painel foi criado exclusivamente para a Parte 3 da atividade acadêmica. Ele demonstra a integração web exigida pelo enunciado e não representa a adoção do Angular no roadmap do produto Araris.

O módulo consome somente a API de demonstração em Spring Boot, que também pode ser selecionada temporariamente pelo aplicativo mobile. Django e React Native continuam preservados e não são substituídos por este recorte.

## Escopo implementado

- `/login`: autenticação por e-mail e senha na API Spring;
- `/home`: cards de saldo, entradas, saídas e resultado, compromissos e atividade recente;
- `/admin/movimentacoes`: listagem combinada de entradas e saídas;
- cadastro, edição e exclusão de movimentações;
- filtros por mês, tipo e texto;
- guarda de autenticação para as rotas administrativas;
- interceptor HTTP para envio do access token;
- estados visuais de carregamento, erro, sucesso e lista vazia;
- layout responsivo para desktop e telas menores.

O chatbot não faz parte deste painel. A versão atual do chatbot pertence ao backend Django, e conectá-la aqui faria o Angular consumir duas APIs e dois contratos de autenticação. A entrega mantém deliberadamente uma única integração, com o Spring.

## Relação com os requisitos

| Requisito                   | Implementação                                                                |
| --------------------------- | ---------------------------------------------------------------------------- |
| Painel integrado à API REST | `FinanceService` e `AuthService` consomem `http://localhost:8080/api`        |
| HttpClient                  | configurado por `provideHttpClient` e usado nos serviços                     |
| Interpolação `{{ }}`        | títulos, usuário, empresa, valores e mensagens                               |
| Property binding `[ ]`      | estados `disabled`, classes condicionais, valores de opções e atributos ARIA |
| Event binding `( )`         | envio de formulários, filtros, edição, exclusão e logout                     |
| Two-way binding `[( )]`     | formulários e filtros com `[(ngModel)]`                                      |
| `*ngIf`                     | carregamento, erro, sucesso, formulário lateral e lista vazia                |
| `*ngFor`                    | cards de carregamento, atividades, movimentações e opções dos selects        |
| Rotas                       | `/login`, `/home` e `/admin/movimentacoes`                                   |
| Formulário funcional        | cadastro e edição de entradas e saídas                                       |
| Proteção básica             | `authGuard`, `guestGuard` e interceptor JWT                                  |
| Feedback visual             | skeleton, spinner, alertas e estados vazios                                  |

O projeto usa componentes standalone. `*ngIf` e `*ngFor` foram mantidos intencionalmente porque o enunciado exige a demonstração explícita dessas diretivas.

## Arquitetura

```text
src/app
├── core
│   ├── guards          # proteção de rotas
│   ├── interceptors    # Authorization: Bearer
│   ├── models          # contratos TypeScript da API
│   └── services        # autenticação, finanças e mensagens de erro
├── layout              # navegação administrativa
└── pages
    ├── login
    ├── home
    └── movements
```

## Executar localmente

Pré-requisitos:

- Node.js 24;
- PostgreSQL do projeto em execução;
- API Spring iniciada na porta 8080.

No primeiro terminal:

```bash
cd ../araris-spring
./gradlew bootRun
```

No segundo terminal:

```bash
cd ../araris-angular
npm install
npm start
```

Acesse `http://localhost:4200`. Use `localhost`, pois essa é a origem liberada por padrão no CORS do Spring.

A URL da API está centralizada em `src/environments/environment.ts`:

```ts
apiUrl: 'http://localhost:8080/api';
```

O Spring lê o mesmo PostgreSQL configurado no Django. Assim, uma conta local criada pelo Django pode ser usada no painel, e as movimentações são refletidas no aplicativo mobile quando ele consulta o mesmo banco.

## Sessão e segurança

- o login usa `/api/accounts/login/`;
- o perfil e a empresa ativa vêm de `/api/accounts/me/`;
- o access token é enviado pelo interceptor nos endpoints privados;
- as rotas administrativas redirecionam usuários sem token para `/login`;
- o logout remove os dados locais da sessão;
- HTTPS deve ser usado fora do ambiente local.

Os JWTs do Spring e do Django não são intercambiáveis, mesmo que os usuários e os dados estejam no mesmo banco.

## Validação

```bash
npm test -- --watch=false
npm run build
```

Além dos testes unitários, o fluxo foi validado no navegador com a conta de demonstração: login, resumo financeiro, listagem, cadastro, edição, exclusão e redirecionamento de rota protegida.

## Tecnologias

- Angular 22 com componentes standalone;
- TypeScript 6;
- Angular Router;
- HttpClient e interceptors funcionais;
- FormsModule e formulários template-driven;
- SCSS responsivo e tipografia Poppins incorporada localmente;
- Vitest para testes unitários.
