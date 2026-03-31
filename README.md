<p align="center">
  <img src="docs/assets/selah-banner.svg" alt="Selah IA Banner" width="100%" />
</p>

<h1 align="center">🕊️ Selah IA</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.2.0-22c55e" alt="Version" />
  <img src="https://img.shields.io/badge/NestJS-10-e0234e?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Provider-Gemini%20Developer%20API-0ea5e9" alt="Provider" />
  <img src="https://img.shields.io/badge/Status-Em%20Opera%C3%A7%C3%A3o-0f766e" alt="Status" />
</p>

# 🤖 Selah IA 1.2.0: Expansão do assistente LUMEN
A versão 1.2.0 leva o `SelahIA` além do PraiseApp e fortalece o adapter de vida pessoal/financeira do LUMEN com respostas mais específicas, saídas estruturadas mais ricas e fallback orientado a problemas concretos como dívida, aperto financeiro e rotina.

## ✨ Visão rápida

- 🧠 **Core reutilizável:** providers, capabilities e adapters desacoplados.
- 🔐 **Segurança entre serviços:** autenticação interna com `X-Selah-Api-Key`.
- 🧩 **Adaptação por domínio:** PraiseApp e LUMEN compartilham a mesma base, com prompts e contratos próprios.
- 🛟 **Fallback inteligente:** respostas genéricas agora disparam retry guiado e regras locais quando necessário.

## 🧩 Funcionalidades resumidas

### 🆕 Destaques da versão 1.2.0
- **Adapter LUMEN reforçado** para perguntas sobre quitação de dívida, reorganização financeira e vida pessoal.
- **Extração de fatos da pergunta** para citar valores, sinais e alvos explícitos do usuário.
- **Saída estruturada ampliada** para até 6 highlights e 6 suggested actions.
- **Fallback rule-based** quando a IA insistir em respostas genéricas demais.
- **Cobertura de testes** para retry e fallback do adapter do LUMEN.

### 🧠 1) Core da plataforma
- Geração de texto e JSON estruturado com validação pós-provider.
- Contrato único para troca futura de provider sem reescrever adapters.
- Capabilities reutilizáveis para outros SaaS internos.

### 🔌 2) Provider atual
- `Gemini Developer API`.
- Saída estruturada via `responseMimeType: application/json`.
- JSON Schema via `responseJsonSchema`.
- `thinkingBudget` configurável para cenários estruturados.

### ⛪ 3) Adaptadores ativos
- **PraiseApp:** Kids, Louvor, Consolidação e Saúde Ministerial.
- **LUMEN:** Assistente de vida com foco em finanças, decisões práticas e rotina pessoal.

## 🧱 Stack

- NestJS 10
- Gemini Developer API
- Axios
- Class Validator / Class Transformer
- Jest

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
- `SELAH_ALLOWED_SOURCE_APPS=PraiseAppBack,Lumen`
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

## ✅ Verificação rápida

```bash
npm run build
npm test -- --runInBand
```

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
    lumen/
      life-assistant/
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

- 📝 Release notes 1.2.0: `docs/releases/v1.2.0.md`
- 📝 Release notes 1.1.0: `docs/releases/v1.1.0.md`
