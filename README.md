# Selah IA

Plataforma interna de IA para os seus SaaS, com `PraiseApp` como primeiro adapter.

O `SelahIA` foi desenhado para:

- centralizar providers de IA em um lugar só
- expor capacidades reutilizáveis para outros SaaS
- manter regras de negócio específicas fora do core
- deixar cada aplicação usar IA pelo próprio backend

## Arquitetura

- `core/capabilities`: capacidades reutilizáveis como geração de texto e saída estruturada
- `providers`: integração com providers de IA
- `adapters`: contratos e prompts específicos de cada aplicação

Fluxo recomendado:

1. `Frontend do SaaS` fala com o backend do produto.
2. `Backend do produto` autentica, aplica permissões e monta o contexto.
3. `SelahIA` recebe esse contexto e fala com o provider.
4. `SelahIA` devolve saída validada e estruturada.
5. `Backend do produto` decide o que persistir.

## Provider atual

- `Gemini Developer API`
- autenticação por `x-goog-api-key`
- geração estruturada via `responseMimeType: application/json`
- JSON Schema via `responseJsonSchema`

Referências oficiais usadas na implementação:

- `https://ai.google.dev/gemini-api/docs/text-generation`
- `https://ai.google.dev/gemini-api/docs/structured-output`
- `https://ai.google.dev/gemini-api/docs/pricing`

## Primeiro adapter entregue

- `PraiseApp`
- domínio inicial: `Kids`
- endpoint:
  - `POST /v1/adapters/praiseapp/kids/lesson-plan/generate`

Esse endpoint recebe:

- referência bíblica
- faixa etária
- tema
- objetivo
- duração
- contexto adicional
- títulos recentes de templates/aulas
- versículo ativo da semana

E devolve:

- título sugerido
- objetivo
- resumo da aula
- quebra-gelo
- fluxo da aula
- atividade
- materiais
- oração
- desafio para casa
- mensagem pronta para pais
- busca sugerida no YouTube
- dicas para o líder
- cuidados pedagógicos

## Variáveis de ambiente

Copie:

```bash
cp .env.example .env
```

Obrigatórias:

- `GEMINI_API_KEY`
- `SELAH_INTERNAL_API_KEYS`

Principais:

- `PORT=3010`
- `GEMINI_MODEL=gemini-2.5-flash`
- `GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta`
- `SELAH_ALLOWED_SOURCE_APPS=PraiseAppBack`

## Execução local

Instalação:

```bash
npm install
```

Desenvolvimento:

```bash
npm run start:dev
```

Build:

```bash
npm run build
```

Healthcheck:

```bash
curl http://localhost:3010/health
```

## Docker

Suba com:

```bash
docker compose up --build
```

O serviço fica em:

- `http://localhost:3010`

## Segurança interna

O `SelahIA` usa `x-selah-api-key` para autenticação entre serviços.

Headers esperados:

- `X-Selah-Api-Key`
- `X-Source-App`
- `X-Request-Id` opcional

## Estrutura

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
  health/
  providers/
    gemini/
```

## Próximos adapters sugeridos

- `PraiseApp/Worship`
- `PraiseApp/Consolidation`
- `PraiseApp/Audit`

## Observações

- o `SelahIA` não grava direto no banco dos seus SaaS
- o `SelahIA` não substitui regras de negócio
- toda decisão final deve continuar no backend do produto consumidor
