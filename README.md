<p align="center">
  <img src="docs/assets/selah-banner.svg" alt="Selah IA Banner" width="100%" />
</p>

<h1 align="center">🕊️ Selah IA</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.1.0-22c55e" alt="Version" />
  <img src="https://img.shields.io/badge/NestJS-10-e0234e?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Provider-Ollama%20%7C%20Gemini-0ea5e9" alt="Provider" />
  <img src="https://img.shields.io/badge/Status-Em%20Opera%C3%A7%C3%A3o-0f766e" alt="Status" />
</p>

# 🤖 Selah IA
Plataforma interna de IA da codeStage, com adapters por domínio sobre um core reutilizável (provider de LLM plugável — Ollama ou Gemini — + capabilities de geração de texto/JSON estruturado).

## ✨ Visão rápida

- 🧠 **Core reutilizável:** providers, capabilities e adapters desacoplados.
- 🔐 **Segurança entre serviços:** autenticação interna com `X-Selah-Api-Key`.
- 🧩 **Adaptação por domínio:** PraiseApp e LUMEN compartilham a mesma base, com prompts e contratos próprios.
- 🛟 **Fallback inteligente:** respostas genéricas disparam retry guiado e regras locais quando necessário.

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
- Selecionável via `LLM_PROVIDER` (`ollama` ou `gemini`), padrão `ollama`.
- `Ollama` (local/self-hosted), modelo padrão `gemma4:e4b`. Suporte a chat com histórico de mensagens, tool calling e imagens inline.
- `Gemini` (Google AI Studio, free tier disponível), modelo padrão `gemini-2.5-flash`.

### ⛪ 3) Adaptadores ativos
- **PraiseApp:** Kids, Louvor, Consolidação e Saúde Ministerial.
- **LUMEN:** Assistente de vida com foco em finanças, decisões práticas e rotina pessoal.

## 🧱 Stack

- NestJS 10
- Ollama (provider LLM local) ou Gemini (provider hospedado, via `LLM_PROVIDER=gemini`)
- Axios
- Class Validator / Class Transformer
- Jest

## ⚙️ Variáveis de ambiente

1. Copie o arquivo base:

```bash
cp .env.example .env
```

2. Configure obrigatoriamente:
- `SELAH_INTERNAL_API_KEYS`
- `OLLAMA_BASE_URL` (se `LLM_PROVIDER=ollama`, o padrão) ou `GEMINI_API_KEY` (se `LLM_PROVIDER=gemini`)

3. Variáveis principais:
- `PORT=3010`
- `SELAH_DEFAULT_LOCALE=pt-BR`
- `SELAH_PUBLIC_VERSION=v1`
- `SELAH_ALLOWED_SOURCE_APPS=PraiseAppBack,LumenBack`
- `LLM_PROVIDER=ollama` (ou `gemini`)
- `OLLAMA_BASE_URL=http://localhost:11434`
- `OLLAMA_MODEL=gemma4:e4b`
- `OLLAMA_TIMEOUT_MS=120000`
- `GEMINI_API_KEY=` (só quando `LLM_PROVIDER=gemini`)
- `GEMINI_MODEL=gemini-2.5-flash`
- `GEMINI_TIMEOUT_MS=45000`

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
    ollama/
    gemini/
```

## 📌 Documentação complementar

- 📝 Release notes 2.0.0: `docs/releases/v2.0.0.md`
- 📝 Release notes 1.3.0: `docs/releases/v1.3.0.md`
- 📝 Release notes 1.2.0: `docs/releases/v1.2.0.md`
- 📝 Release notes 1.1.0: `docs/releases/v1.1.0.md`
