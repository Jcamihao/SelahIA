<p align="center">
  <img src="docs/assets/selah-banner.svg" alt="Selah IA Banner" width="100%" />
</p>

<h1 align="center">🕊️ Selah IA</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-22c55e" alt="Version" />
  <img src="https://img.shields.io/badge/NestJS-10-e0234e?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Provider-Gemini%20Developer%20API-0ea5e9" alt="Provider" />
  <img src="https://img.shields.io/badge/Status-Em%20Opera%C3%A7%C3%A3o-0f766e" alt="Status" />
</p>

Plataforma interna de IA para os seus SaaS, com `PraiseApp` como primeiro produto consumidor e `Kids` como primeiro adapter operacional.

## ✨ Visão rápida

- 🧠 **Core reutilizável:** providers, capabilities e adapters desacoplados.
- 🔐 **Segurança entre serviços:** autenticação interna com `X-Selah-Api-Key`.
- 🧩 **Adaptação por domínio:** prompts e contratos específicos por SaaS.
- 📈 **Observabilidade:** logs com `requestId`, `sourceApp`, duração e telemetria básica do provider.

## 🧩 Funcionalidades resumidas

### 🆕 Destaques da versão 1.0.0
- **Provider Gemini Developer API** integrado com saída estruturada em JSON e parser endurecido para respostas truncadas.
- **Adapter PraiseApp/Kids** entregue de ponta a ponta com geração assistida de conteúdo ministerial.
- **Proteção interna por API key + source app** para impedir consumo direto fora dos seus backends.
- **Observabilidade de requisições** com tracing básico e logs de negócio do fluxo Kids.
- **Execução local e containerização** prontas com `Dockerfile`, `.dockerignore` e `docker-compose.yml`.

### 🧠 1) Core da plataforma
- Geração de texto e JSON estruturado com validação pós-provider.
- Contrato único para troca futura de provider sem reescrever adapters.
- Capabilities reutilizáveis para outros SaaS internos.

### 🔌 2) Provider atual
- `Gemini Developer API`.
- Saída estruturada via `responseMimeType: application/json`.
- JSON Schema via `responseJsonSchema`.
- `thinkingBudget` configurável para cenários estruturados.

### 🧒 3) Primeiro adapter entregue: PraiseApp/Kids
- Geração de planejamento de aula.
- Resumo automático do check-in do dia.
- Sequência pedagógica para a próxima aula.
- Expansão do versículo da semana.
- Assistente operacional do líder.
- Adaptação da mesma aula por faixa etária.

## 🧱 Stack

- NestJS 10
- Gemini Developer API
- Axios
- Class Validator / Class Transformer

## ⚙️ Variáveis de ambiente

1. Copie o arquivo base:

```bash
cp .env.example .env
```

2. Configure obrigatoriamente:
- `GEMINI_API_KEY`
- `SELAH_INTERNAL_API_KEYS`

3. Variáveis principais:
- `PORT=3010`
- `SELAH_DEFAULT_LOCALE=pt-BR`
- `SELAH_PUBLIC_VERSION=v1`
- `SELAH_ALLOWED_SOURCE_APPS=PraiseAppBack`
- `GEMINI_MODEL=gemini-2.5-flash`
- `GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta`
- `GEMINI_TIMEOUT_MS=20000`
- `GEMINI_STRUCTURED_THINKING_BUDGET=0`

## 🚀 Como executar

### 1. Instalar dependências

```bash
npm install
```

### 2. Desenvolvimento

```bash
npm run start:dev
```

### 3. Build + produção local

```bash
npm run build
npm start
```

### 4. Healthcheck

```bash
curl http://localhost:3010/health
```

## 🐳 Docker

Suba com:

```bash
docker compose up --build
```

O serviço sobe em:

- `http://localhost:3010`

## ✅ Verificação rápida

```bash
npm run build
npm run test:e2e -- --runInBand
```

## 🚆 Deploy sem Docker

Para subir no Railway direto do GitHub:

```bash
npm install
npm run build
npm start
```

No serviço, deixe os comandos assim:

- `Build Command`: `npm run build`
- `Start Command`: `npm start`

## 🔐 Segurança interna

O `SelahIA` usa autenticação entre serviços com:

- `X-Selah-Api-Key`
- `X-Source-App`
- `X-Request-Id` opcional

Regra operacional:
- o frontend nunca fala direto com o `SelahIA`
- o backend do SaaS autentica, monta contexto e decide o que persiste

## 🧭 Estrutura principal

```text
src/
  adapters/
    praiseapp/
      kids/
  capabilities/
    structured-output/
    text/
  common/
    auth/
    logging/
  health/
  providers/
    gemini/
```

## 📌 Documentação complementar

- 📝 Release notes 1.0.0: `docs/releases/v1.0.0.md`

## Observações

- O `SelahIA` não grava direto no banco dos seus SaaS.
- O `SelahIA` não substitui regras de negócio.
- Toda decisão final continua no backend do produto consumidor.
