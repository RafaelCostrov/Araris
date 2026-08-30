# Araris — Gestão financeira para MEIs

O Araris é um aplicativo mobile para microempreendedores acompanharem o dinheiro realizado, os compromissos futuros e a saúde do caixa em uma experiência simples. O projeto combina uma API Django multiempresa, um aplicativo React Native e uma assistente financeira conversacional.

## Estado atual do MVP

| Área | Estado atual |
| --- | --- |
| Acesso | Cadastro de usuário e empresa, login local e Google, JWT persistido e edição de dados pessoais |
| Financeiro | Entradas, saídas, contas a pagar e a receber, recorrências, baixa, edição e remoção |
| Clientes e fornecedores | Cadastro opcional, pesquisa, edição, desativação e vínculo com atividades financeiras |
| Home | Resumo mensal, saldo inicial e final, atividade recente e avisos de vencidos ou vencimentos de hoje |
| Dashboard | Projeção determinística de 30 dias, histórico de 3, 6 ou 12 meses e segmentações por categoria, cliente e fornecedor |
| Chatbot | Consultas financeiras e propostas confirmáveis de criação, edição ou remoção |
| Notificações | Central mobile, registro de dispositivos e infraestrutura de push com Firebase |
| Controle do DAS | Tela de implementação; regras tributárias e integração ainda não estão disponíveis |

### Controle financeiro

O aplicativo diferencia movimentações já realizadas de compromissos futuros. Pagar uma conta cria a despesa correspondente; receber uma conta cria a receita correspondente. A baixa é transacional, não pode ser duplicada e preserva o cliente ou fornecedor associado.

As recorrências podem ser semanais, quinzenais, mensais, bimestrais, trimestrais, semestrais ou anuais. Elas aceitam quantidade definida ou uma série sem data final, mantida pelo backend dentro de uma janela futura.

### Home e Dashboard

A Home possui filtro mensal e abre o detalhamento dos valores usados em cada card. Pendências vencidas permanecem visíveis mesmo fora do mês selecionado. Os widgets de urgência priorizam contas vencidas e, quando não há atraso, mostram compromissos que vencem no dia.

O Dashboard usa a data atual e apresenta:

- saldo realizado e projeção diária do caixa para 30 dias;
- entradas e saídas nos últimos 3, 6 ou 12 meses;
- despesas por categoria;
- entradas por cliente e saídas por fornecedor;
- principais compromissos que impactarão o caixa.

A projeção atual é determinística: parte do saldo realizado, soma contas a receber e subtrai contas a pagar nas datas de vencimento. Ela não é uma previsão estatística ou gerada por IA.

### Assistente financeira

O chatbot usa LangChain com Gemini como provedor principal e Groq como fallback quando ambos estão configurados. Ele consulta somente dados da empresa autorizada e pode preparar propostas para:

- criar, editar ou remover entradas e saídas;
- criar, editar ou cancelar contas a pagar e a receber;
- criar, editar ou desativar clientes e fornecedores.

Nenhuma alteração é executada apenas porque o modelo respondeu. O usuário recebe um resumo e precisa confirmar a proposta no aplicativo. Pagamentos e recebimentos continuam sendo feitos exclusivamente pelas telas financeiras.

As respostas aceitam Markdown, com títulos, listas, ênfase, links, citações e blocos de código. Erros podem ser reenviados pelo botão **Tentar novamente**. A tela inicial sempre começa uma conversa nova; conversas recentes podem ser retomadas ou removidas com um gesto para a esquerda.

## O que ainda não faz parte do MVP

- alertas automáticos de vencimento conectados ao push;
- geração, consulta ou pagamento do DAS;
- cálculo e alertas do limite anual do MEI;
- previsão estatística ou por aprendizado de máquina;
- upload de comprovantes e outros documentos;
- convites, troca de empresa e permissões multiusuário completas;
- billing, planos e cobrança SaaS.

Esses itens permanecem no roadmap e não devem ser apresentados como recursos disponíveis.

## Arquitetura

- **Aplicativo:** React Native, Expo 54, Expo Router, NativeWind, React Native Gifted Charts e React Native Gesture Handler.
- **API:** Python, Django 5, Django REST Framework e Simple JWT.
- **Banco:** PostgreSQL.
- **IA:** LangChain, Google Gemini e Groq.
- **Notificações:** Expo Notifications e Firebase Admin SDK.
- **Integrações:** ViaCEP, BrasilAPI e Google OAuth.

O backend é um monólito modular separado por domínio. O código está dividido em `araris-front`, para o aplicativo, e `araris-back`, para a API e as regras de negócio.

### Implementação acadêmica em Spring Boot

O diretório `araris-spring` contém uma API paralela criada exclusivamente para atender à atividade acadêmica de Spring Boot. Ela demonstra autenticação, autorização, persistência, CRUD financeiro, Swagger, Thymeleaf e testes, mas **não substitui o Django e não representa um plano de migração do produto**. Para a demonstração, ambos acessam as mesmas tabelas de negócio no PostgreSQL; as migrations dessas tabelas continuam pertencendo ao Django. Consulte a [documentação da API Spring](araris-spring/README.md).

### Implementação acadêmica em Angular

O diretório `araris-angular` contém o painel administrativo exigido pela Parte 3 da mesma atividade. Ele apresenta login, resumo financeiro e CRUD de movimentações consumindo exclusivamente a API Spring, com HttpClient, rotas, guards, formulários com `[(ngModel)]`, data binding e diretivas estruturais. Assim como o módulo Spring, **esse painel é um recorte acadêmico e não representa a adoção do Angular no roadmap do produto**. Consulte a [documentação do painel Angular](araris-angular/README.md).

## Configuração local

### Backend

Crie `araris-back/.env` com as configurações do Django, PostgreSQL e integrações necessárias. Para habilitar o chatbot, use:

```env
GEMINI_API_KEY=SUA_CHAVE_DO_GEMINI
GEMINI_MODEL=gemini-3.6-flash
GEMINI_REQUEST_TIMEOUT=30
GROQ_API_KEY=SUA_CHAVE_DO_GROQ
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_REQUEST_TIMEOUT=30
CHATBOT_HISTORY_MESSAGES=12
CHATBOT_ACTION_EXPIRATION_MINUTES=15
```

Pelo menos uma chave de provedor é necessária para o chat. Com as duas configuradas, o Gemini é tentado primeiro e o Groq assume quando a chamada falha. As chaves pertencem somente ao backend e nunca devem receber o prefixo `EXPO_PUBLIC_`.

```bash
cd araris-back
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### Aplicativo

```bash
cd araris-front
npm install
npx expo start
```

Em desenvolvimento, o app usa `10.0.2.2` no emulador Android, o host do servidor Metro em aparelhos físicos e `127.0.0.1` quando aplicável. URLs explícitas podem ser definidas por `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_URL_ANDROID`, `EXPO_PUBLIC_API_URL_IOS` e `EXPO_PUBLIC_API_URL_WEB`.

O login Google depende de módulo nativo e deve ser testado em uma development build, não no Expo Go. O celular e o computador também precisam conseguir alcançar a mesma API na rede local.

## Conta local de demonstração

O comando abaixo é idempotente e prepara seis meses de dados para uma empresa fictícia de salão de beleza, incluindo clientes, fornecedores, movimentos realizados, recorrências e duas contas vencidas em 08/08/2026:

```bash
araris-back/.venv/bin/python araris-back/manage.py seed_demo_account \
  --email b@a.com \
  --password 'Senha@1235'
```

- Usuária: **Millena**
- Empresa: **Studio Millena Cabelos & Beleza**
- E-mail: `b@a.com`
- Senha: `Senha@1235`

Essa conta é somente para desenvolvimento e demonstração local. O comando não cria histórico do chatbot, para que as conversas possam ser demonstradas do zero.

## Documentação

- [Módulo financeiro](araris-back/apps/finance/README.md)
- [Módulo de chatbot](araris-back/apps/chatbot/README.md)
- [Módulo de notificações](araris-back/apps/notifications/README.md)
