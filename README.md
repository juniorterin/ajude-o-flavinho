# Vaquinha do Flavinho — site próprio com Stripe

Site de doação com identidade própria, baseado na campanha original
(http://vakinha.com.br/vaquinha/flavinho-precisa-de-voces), pagamentos
processados pela **Stripe** com suporte a **cartão, Apple Pay e Google Pay**.
Feito para rodar no **Vercel** (funções serverless em `/api` + site estático
em `/public`).

Disponível em dois idiomas:

- `/pt-br` — versão em português
- `/jap` — versão em japonês (para quem conheceu o Flavio no Japão)
- `/` — página simples de escolha de idioma

## Como funciona (importante entender antes de configurar)

- Quando alguém clica em "Doar agora", o site chama
  `/api/create-checkout-session`, que cria uma sessão do **Stripe Checkout**
  — a página de pagamento oficial hospedada pela própria Stripe
  (`checkout.stripe.com`) — e redireciona o doador para lá.
- **Apple Pay e Google Pay aparecem automaticamente** nessa página quando
  estão habilitados na sua conta Stripe e o navegador/aparelho do doador os
  suporta. Não precisa configurar nada extra nem verificar domínio, porque o
  pagamento acontece no domínio da própria Stripe (isso só seria necessário
  se, no futuro, vocês quisessem um botão de pagamento embutido dentro da
  própria página).
- Cada doação confirmada é gravada num banco de dados **Redis (Upstash)** —
  online, gratuito, sem servidor pra manter. Quem grava é o webhook
  (`/api/webhook`): a Stripe avisa "esse pagamento foi concluído" e o site
  soma o valor e guarda o registro. A barra de progresso (`/api/progress`)
  só lê esse total já pronto, sem precisar consultar a Stripe toda vez.
- Nenhum dado de cartão passa pelo seu servidor — a Stripe cuida de tudo
  (o site está em conformidade com PCI DSS por causa disso).

## 1. Pré-requisitos

- Conta na Stripe: https://dashboard.stripe.com/register
  - **Importante:** crie a conta com os dados de quem vai efetivamente
    receber o dinheiro (o Flavio, ou alguém formalmente autorizado por ele).
    A Stripe faz verificação de identidade (KYC) e os repasses caem na conta
    bancária cadastrada nessa conta Stripe — não na sua, a menos que seja
    você mesmo quem vai repassar o valor a ele depois.
  - Confira em Configurações > Métodos de pagamento se **Cartão**, **Apple
    Pay** e **Google Pay** estão habilitados (por padrão já vêm ativos para
    a maioria das contas).
- Conta no Vercel: https://vercel.com/signup
- Node.js instalado localmente (só se for testar antes do deploy).

## 2. Banco de dados (Redis via Upstash) — online, gratuito, sem hospedar nada

É um banco **gerenciado na nuvem**: você não sobe servidor nem mantém nada
rodando, só cria e conecta.

**Caminho mais simples — direto pelo Vercel:**

1. No painel do Vercel, abra o projeto (crie um projeto vazio agora se ainda
   não importou o repositório — dá pra conectar o banco antes de publicar).
2. Vá na aba **Storage → Create Database**.
3. Escolha **Upstash** → **Redis** (aparece no marketplace de integrações,
   plano gratuito já vem selecionado).
4. Dê um nome (ex: `flavinho-db`) e confirme.
5. Na tela seguinte, clique em **Connect Project** e selecione este projeto.
   Isso já injeta `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, dependendo da versão
   do painel) automaticamente nas variáveis de ambiente — não precisa copiar
   nada manualmente.

Se preferir, também dá pra criar a conta direto em https://upstash.com
(gratuito) e colar a "REST URL" e o "REST TOKEN" do banco manualmente nas
variáveis de ambiente do Vercel — o resultado final é o mesmo.

## 3. Webhook da Stripe (obrigatório — é o que liga o pagamento ao banco)

1. Dashboard Stripe > Developers > Webhooks > **Add endpoint**.
2. URL: `https://SEU-DOMINIO/api/webhook`
3. Evento: `checkout.session.completed`
4. Copie o "Signing secret" gerado (`whsec_...`) e adicione como
   `STRIPE_WEBHOOK_SECRET` nas variáveis de ambiente do Vercel.

Sem isso, os pagamentos continuam funcionando normalmente, mas o total
arrecadado exibido no site não vai atualizar.

## 4. Rodar localmente (opcional, para testar antes de publicar)

```bash
npm install
npx vercel dev
```

Preencha o `.env.local` (copie de `.env.example` se ainda não tiver) com as
chaves de **teste** da Stripe (`sk_test_.../pk_test_...`) e as variáveis do
banco Redis. Se o banco já estiver conectado ao projeto no Vercel, rode
`vercel env pull .env.local` pra puxar tudo automaticamente em vez de copiar
na mão. Com o servidor rodando, abra `http://localhost:3000` e teste uma
doação com o cartão de teste da Stripe: número `4242 4242 4242 4242`,
validade e CVC quaisquer, futuros.

## 5. Publicar no Vercel

Com o projeto em um repositório Git (GitHub/GitLab/Bitbucket):

1. No Vercel, clique em **Add New > Project** e importe o repositório (ou
   use o mesmo projeto onde você já conectou o banco no passo 2).
2. Em **Environment Variables**, confirme que estão configuradas:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (ou os
     equivalentes `KV_REST_API_URL` / `KV_REST_API_TOKEN`, já preenchidos
     automaticamente se você conectou o banco pela aba Storage)
   - `GOAL_CENTS` → `1500000` (R$ 15.000,00, ajuste se quiser)
   - `BASE_RAISED_CENTS` → `53829` (R$ 538,29 já arrecadados via Pix na
     vaquinha original — ajuste ou zere se não quiser somar esse valor)
3. Clique em **Deploy**.

Ou, via linha de comando, direto da pasta do projeto:

```bash
vercel          # cria um deploy de preview
vercel --prod   # publica em produção
```

O Vercel vai te dar uma URL do tipo `https://flavinho.vercel.app`. Se depois
você registrar um domínio próprio (ex: `ajudeoflavio.com.br`), basta
adicioná-lo em Project Settings > Domains — e lembre de atualizar a URL do
webhook (passo 3) para o domínio novo.

## 6. Ir para produção (dinheiro de verdade)

Enquanto as chaves forem `sk_test_.../pk_test_...`, nenhum pagamento é real.
Quando estiver tudo testado:

1. No Dashboard da Stripe, complete a ativação da conta (dados bancários,
   documentos) se ainda não tiver feito.
2. Copie as chaves **live** (`sk_live_...` / `pk_live_...`) em Developers >
   API keys.
3. No Vercel, atualize `STRIPE_SECRET_KEY` e `STRIPE_PUBLISHABLE_KEY` com os
   valores live (Project Settings > Environment Variables) e faça um novo
   deploy (`vercel --prod` ou um novo commit).
4. Crie um novo endpoint de webhook (passo 3) apontando pro mesmo domínio,
   mas em modo live (o toggle "Test mode" desligado no Dashboard da Stripe
   também existe na tela de Webhooks) e atualize `STRIPE_WEBHOOK_SECRET`
   com o novo signing secret.

## Estrutura do projeto

```
api/
  create-checkout-session.js   cria a sessao de pagamento na Stripe
  progress.js                  le o total arrecadado direto do banco (Redis)
  session/[id].js              confirma uma doacao apos o checkout
  webhook.js                   grava cada doacao confirmada no banco (obrigatorio)
lib/
  redis.js                     conexao com o banco Redis (Upstash)
public/
  index.html                   escolha de idioma
  pt-br/                       versao em portugues (index, success, cancel)
  jap/                         versao em japones (index, success, cancel)
  styles.css / script.js       compartilhados pelas duas versoes
  images/capa.jpg              foto usada na campanha original
```

### Ver as doações gravadas

Não é preciso construir nada extra: o painel gratuito do Upstash
(https://console.upstash.com) tem um navegador de dados embutido. Abra o
banco criado, procure a chave `flavinho:donations` (uma lista, uma doação
por item, em JSON) e `flavinho:total_cents` (o total em centavos).

## Personalizar

- **Textos e história:** editar `public/pt-br/index.html` e
  `public/jap/index.html`.
- **Meta e valor já arrecadado fora da Stripe:** variáveis `GOAL_CENTS` e
  `BASE_RAISED_CENTS` no Vercel.
- **Valores sugeridos de doação:** editar os botões `data-amount` em
  `public/pt-br/index.html` / `public/jap/index.html`.
- **Foto de capa:** trocar `public/images/capa.jpg`.
