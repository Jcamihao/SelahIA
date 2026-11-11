# HANDOFF — Selah IA

> **Para a próxima IA (ou pessoa) que abrir este repositório: leia este arquivo primeiro.**
> Última atualização: 2026-11-11, v2.9.0, branch `claude/charming-bohr-b00dys`.
> **Regra do dono do projeto:** toda sessão de trabalho termina atualizando este arquivo (seção "Estado atual" e "Histórico"). Ver `AGENTS.md`.

## 1. O que é
API interna em **NestJS 10** da codeStage. Fica entre os backends de SaaS internos e um LLM (**Gemini** por padrão, **Ollama** opcional). Cada SaaS tem um **adapter** com rotas, prompt, schema JSON e validador. Stateless: sem banco; o backend do SaaS monta o contexto e decide o que persiste. O frontend nunca fala com o Selah.

Idioma: README, commits, comentários e mensagens de erro em **português** (sem acentos nos comentários e logs do código). Responda ao usuário em português.

## 2. Comandos
```bash
npm ci
npm run build                              # nest build
npx jest                                   # 339 unitarios (rootDir=src, *.spec.ts)
npm run test:e2e                           # 17 e2e (test/*.e2e-spec.ts, AppModule real; so o provider e falso)
npm run start:dev                          # watch
curl localhost:3010/health
```
Existe `scripts/smoke-meal-photo.mjs` (smoke do meal-photo; **não li nem executei**, confira o conteúdo antes de rodar). O plano gratuito do Gemini tem 5 req/min.

## 3. Mapa do código
```
src/
  main.ts                    # bootstrap: valida env e chama configureApp
  app.setup.ts               # configureApp: shutdown hooks, trust proxy, helmet, portao de auth, parser, ValidationPipe (usado por main e e2e)
  app.module.ts              # liga os modulos + RetryAfterExceptionFilter (APP_FILTER)
  adapters/<app>/<feature>/  # controller + service + prompt + schemas(+validate) + dto + specs
    agilis/workspace         # chat + 7 rotas (resumos, plano, gargalos, responsavel, carga, brief)
    balancogordura/meal-photo# foto de refeicao -> alimentos de lista fechada (NAO estima calorias)
    lumen/life-assistant     # chat financeiro/vida, com retry e fallback por regra
    lumen/receipt-parser     # recibo -> JSON
    praiseapp/{kids,worship,consolidation,service-reports}
    psicologia/rascunho      # nota ANONIMIZADA -> rascunho de evolucao/anamnese (dado clinico!)
  providers/
    llm-provider.interface.ts# contrato: generateStructured, generateStructuredFromContents, generateTextFromContents
    gemini/ ollama/          # implementacoes; provider-selection.ts escolhe por LLM_PROVIDER
    provider-errors.ts       # excecoes: Quota(503), Upstream(502, transient), Busy(503), Unavailable(503), TokenBudget(429)
    resilience/              # ResilientLlmProvider envolve o provider ativo: teto de tokens, circuit breaker, concorrencia, metricas
    safe-token.ts            # so enums seguros vao para log/502
  common/
    auth/                    # InternalApiKeyGuard, ApiKeyRegistry (chave por app), RateLimiterService, pre-auth.gate (401 antes de ler o corpo)
    config/validate-env.ts   # validacao do env no boot (+ INT_ENV_SPECS e readEnvInt); app-limits.ts parseia App:valor
    http/retry-after.filter.ts, trust-proxy.ts
    metrics/                 # MetricsService (Prometheus em texto, sem dependencia) + GET /metrics
    logging/                 # middleware com request id; teste de que PII nao vaza nos logs
  health/                    # GET / e GET /health (abertos, sem chave)
```
Rotas: todas `POST /v1/adapters/<app>/<feature>/<acao>`. Lista completa: `grep -rn "@Post" src --include=*.controller.ts`.

Padrão de um adapter: DTO (class-validator) → prompt → `llmProvider.generateStructured(...)` com `responseSchema` + `validate` → resposta `{provider, version, model, generatedAt, ...dados}`. O LLM nunca devolve texto livre sem validação.

## 4. Regras que NÃO podem ser quebradas
1. **Identidade do app vem da chave** (`SELAH_APP_KEYS=App:chave`), nunca do header `X-Source-App`.
2. **Logs só com metadados** (tamanhos, tipos, latência, enums). Nunca conteúdo de nota, prompt, saída do modelo ou texto de erro do upstream. `no-personal-data-in-logs.spec.ts` guarda isso; adapter novo deve entrar nele.
3. **Erro do upstream nunca vai para log nem corpo de erro** (v2.7.2). Só status, código de rede e enums (`safe-token.ts`).
4. **Entrada do usuário é dado, não instrução**: delimitar no prompt (ver `<<<NOTA ... NOTA>>>` em psicologia) e remover o delimitador da própria entrada.
5. **Psicologia só recebe dado sintético** enquanto a chave do Gemini for do plano gratuito. O Selah **não anonimiza**; isso é do Notta.psi.
6. **Códigos de erro têm significado fixo** (v2.8.0/2.9.0): `429` = limite do **Selah** (rate limit por minuto ou teto diário de tokens); `503` + `reason` = provedor (`PROVIDER_QUOTA_EXCEEDED`, `PROVIDER_BUSY`, `PROVIDER_UNAVAILABLE`); `502` = falha do provedor ou saída inválida. Todos com `Retry-After` quando aplicável. Não misture.
7. **Só falha transitória do provedor abre o circuit breaker** (`ProviderUpstreamException.transient`): resposta inválida, 4xx e cota **não** abrem. Se criar um provider novo, marque `transient` direito.
8. Mudou comportamento visível para consumidores? Bump de versão em `package.json`, nota em `docs/releases/vX.Y.Z.md` e linha no README.

## 5. Estado atual (v2.9.0)
- Build ok, lint limpo (eslint + prettier), **339 unitários e 17 e2e passando** (verificado nesta sessão). O lint é gate do CI; rode `npx eslint "{src,test}/**/*.ts"` antes de commitar e `npx prettier --write` nos arquivos que tocar.
- **2.8.0:** CI, shutdown gracioso (+ `stop_grace_period: 50s`), validação de env no boot, cota do Gemini como 503 + `Retry-After`, formatação de todo o código. **2.9.0:** limite de concorrência com fila, circuit breaker, nova tentativa em JSON inválido, `/metrics`, teto diário de tokens por app, 401 antes de ler o corpo, `trust proxy`. Detalhes e impacto em `docs/releases/v2.8.0.md` e `v2.9.0.md`.
- **Verificado com o processo real** (`node dist/main` + Gemini falso programável): shutdown com requisição em andamento (v2.8.0); circuito, fila cheia, nova tentativa, cota e métricas (v2.9.0).
- Produção: Docker Compose (`docker-compose.prod.yml`) em `127.0.0.1:3020` atrás do nginx (`deploy/nginx/selah.conf`, `selah.financelumen.tech`). O `Dockerfile` já tem `HEALTHCHECK` e roda como usuário `node`.
- **Nada foi deployado nem pushado para `master` por esta sessão.** O trabalho está na branch `claude/charming-bohr-b00dys`.

## 6. Dívidas conhecidas (não resolvidas)
| Item | Detalhe |
|---|---|
| **`npm audit`** | 10 vulnerabilidades (1 crítica, 4 altas) em dependências de produção via `express`/`qs`; a correção do audit exige `@nestjs/platform-express@12` (major). Não tentado. |
| **Estado em memória, por instância** | Rate limit, limite de concorrência, circuit breaker e teto diário de tokens zeram a cada restart e valem por réplica. Redis só se houver mais de uma réplica. |
| **Psicologia** | Decisão pendente: rascunho **fiel** à nota ou **reescrito** (hoje sai do tamanho da nota). Não verificado: anamnese colada sem quebras de linha, autolesão em PSICANALISE, notas perto de 8.000 caracteres. |
| **Consumidores e os novos códigos** | Não foi verificado como Lumen, PraiseApp, Agilis, BalancoGordura e Notta.psi tratam 503 (`PROVIDER_QUOTA_EXCEEDED`, `PROVIDER_BUSY`, `PROVIDER_UNAVAILABLE`) e 429 com corpo (`DAILY_TOKEN_BUDGET_EXCEEDED`). Antes a cota era 502. |
| **Tokens da tentativa descartada** | Na nova tentativa por JSON inválido só os tokens da última resposta entram na métrica e no teto diário; o gasto real pode ser maior. O Ollama não informa tokens (teto e métrica de tokens só valem para o Gemini). |
| **`trust proxy` e nginx não testados em produção** | O padrão `loopback,uniquelocal` assume que o nginx chega ao container por IP privado (bridge do Docker). Conferir no servidor que o `ip=` do log é o do cliente. Se aparecer o IP do gateway do Docker, ajustar `SELAH_TRUST_PROXY`. O bloco `location = /metrics` do nginx também não foi executado (`nginx -t` não rodou). |
| **`/metrics` sem scraper configurado** | A rota existe e exige chave; falta criar a chave `Prometheus:<chave>` em `SELAH_APP_KEYS` e configurar o scrape (e alertas, ex.: `selah_llm_circuit_state == 2`). Nada disso foi feito. |
| **Padrões de resiliência não calibrados** | 10 simultâneas, fila 20, circuito 5 falhas/30 s, teto de tokens desligado: são palpites razoáveis, não medidos com tráfego real. |

## 7. Não verificado / não lido
- Os prompts e services de **Kids, Louvor, Consolidação, Relatórios, Lumen e Agilis** foram só mapeados por rotas, não lidos.
- Nada foi testado contra o **Gemini real** nesta sessão (só mocks e um Gemini falso local). Isso inclui a nova tentativa em JSON inválido: o comportamento com saídas inválidas reais do Gemini não foi observado.
- O nginx e o compose de produção não foram executados.

## 8. Decisões de design discutidas (não implementadas)
- **RAG / MCP:** o dono não tem caso de uso hoje (apps são locais e pequenos). Se retomar: módulo `rag` **desligado por padrão**, interfaces `EmbeddingProvider` / `VectorStore` / `RetrievalService`, índice isolado por app (vem da chave de API), piloto em **PraiseApp Kids** (`next-sequence`), **sem MCP** na primeira fase. O `GeminiProvider` não tem function calling nem embeddings hoje. Fora de escopo: dados clínicos de psicologia.

## 9. Histórico
| Versão | O que entrou |
|---|---|
| 2.9.0 | Concorrência com fila, circuit breaker, nova tentativa em JSON inválido, `/metrics`, teto diário de tokens por app, 401 antes de ler o corpo, `trust proxy` |
| 2.8.0 | Formatação de todo o código com prettier (commit só de estilo) e lint como gate do CI; CI, shutdown gracioso, validação de env no boot, quota do Gemini como 503 + `Retry-After` |
| 2.7.9 | Verificação com Gemini real do adapter psicologia (sem código) |
| 2.7.x | Psicologia: endurecimento do prompt, erro do upstream fora de log/502, `safe-token` |
| 2.6.x | BalancoGordura `meal-photo` |
| 2.5.x e antes | Ver `docs/releases/` |

## 10. Como atualizar este arquivo
Ao terminar uma sessão: ajuste a data/versão no topo, o "Estado atual", mova itens resolvidos para fora de "Dívidas", registre o que **não** foi verificado, e acrescente uma linha ao "Histórico". Escreva só o que você verificou; marque o resto como não verificado.
