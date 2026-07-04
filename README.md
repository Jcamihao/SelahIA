<p align="center">
  <img src="docs/assets/selah-banner.svg" alt="Selah IA Banner" width="100%" />
</p>

<h1 align="center">🕊️ Selah IA</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.3.0-22c55e" alt="Version" />
  <img src="https://img.shields.io/badge/NestJS-10-e0234e?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Provider-Ollama-0ea5e9" alt="Provider" />
  <img src="https://img.shields.io/badge/Status-Em%20Opera%C3%A7%C3%A3o-0f766e" alt="Status" />
</p>

# 🤖 Selah IA 1.3.0: Selah Coder Agent mais seguro e autônomo
A versão 1.3.0 evolui o `Selah Coder`, o agente de codificação autônoma sobre Ollama, com aprovação humana para comandos destrutivos, snapshots git automáticos, cancelamento de execuções, streaming token a token, detecção automática de arquivos relevantes por tarefa e uma nova tool `run_tests` que roda a suíte de testes do projeto (jest/vitest/pytest).

## ✨ Visão rápida

- 🧠 **Core reutilizável:** providers, capabilities e adapters desacoplados.
- 🔐 **Segurança entre serviços:** autenticação interna com `X-Selah-Api-Key`.
- 🧩 **Adaptação por domínio:** PraiseApp, LUMEN e Selah Coder compartilham a mesma base, com prompts e contratos próprios.
- 🛟 **Fallback inteligente:** respostas genéricas agora disparam retry guiado e regras locais quando necessário.
- 🧑‍💻 **Agente de código autônomo:** Selah Coder executa tarefas de desenvolvimento com ferramentas de filesystem, shell e git, com aprovação humana para ações destrutivas.

## 🧩 Funcionalidades resumidas

### 🆕 Destaques da versão 1.3.0
- **Gate de aprovação humana** para comandos `run_bash` potencialmente destrutivos, com expiração automática.
- **Snapshot git automático** antes de cada tarefa, permitindo rollback rápido.
- **Cancelamento cooperativo** de execuções em andamento via SSE.
- **Detecção automática de arquivos relevantes** por tarefa (grep de identificadores) e suporte a `.selah/instructions.md` para regras imutáveis por projeto.
- **Continuação de sessão** (histórico de mensagens) e poda automática de contexto para tarefas longas.
- **Nova tool `run_tests`** (jest/vitest/pytest) e verificação automática de TypeScript após cada escrita de arquivo.
- **Streaming token a token** e diffs estruturados na UI do Selah Coder.
- **Modelo Ollama padrão** atualizado para `gemma4:e4b`.

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
- `Ollama` (local/self-hosted), modelo padrão `gemma4:e4b`.
- Suporte a chat com histórico de mensagens, tool calling e imagens inline.
- Streaming token a token para uso em SSE (Selah Coder).

### ⛪ 3) Adaptadores ativos
- **PraiseApp:** Kids, Louvor, Consolidação e Saúde Ministerial.
- **LUMEN:** Assistente de vida com foco em finanças, decisões práticas e rotina pessoal.
- **Selah Coder:** Agente de codificação autônoma com acesso a filesystem, shell e git, aprovação humana para ações destrutivas e ferramenta `run_tests`.

## 🧱 Stack

- NestJS 10
- Ollama (provider LLM local)
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
- `OLLAMA_BASE_URL`

3. Variáveis principais:
- `PORT=3010`
- `SELAH_DEFAULT_LOCALE=pt-BR`
- `SELAH_PUBLIC_VERSION=v1`
- `SELAH_ALLOWED_SOURCE_APPS=PraiseAppBack,VeloBack,LumenBack`
- `OLLAMA_BASE_URL=http://localhost:11434`
- `OLLAMA_MODEL=gemma4:e4b`
- `OLLAMA_TIMEOUT_MS=120000`

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
    selah-coder/
  capabilities/
    structured-output/
    text/
  common/
    auth/
    logging/
  health/
  providers/
    ollama/
```

## 📌 Documentação complementar

- 📝 Release notes 1.3.0: `docs/releases/v1.3.0.md`
- 📝 Release notes 1.2.0: `docs/releases/v1.2.0.md`
- 📝 Release notes 1.1.0: `docs/releases/v1.1.0.md`
