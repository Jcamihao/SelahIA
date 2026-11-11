# HANDOFF — Selah IA

> **Para a próxima IA (ou pessoa) que abrir este repositório: leia este arquivo primeiro.**
> Última atualização: 2026-11-11, v2.8.0, branch `claude/charming-bohr-b00dys`.
> **Regra do dono do projeto:** toda sessão de trabalho termina atualizando este arquivo (seção "Estado atual" e "Histórico"). Ver `AGENTS.md`.

## 1. O que é
API interna em **NestJS 10** da codeStage. Fica entre os backends de SaaS internos e um LLM (**Gemini** por padrão, **Ollama** opcional). Cada SaaS tem um **adapter** com rotas, prompt, schema JSON e validador. Stateless: sem banco; o backend do SaaS monta o contexto e decide o que persiste. O frontend nunca fala com o Selah.

Idioma: README, commits, comentários e mensagens de erro em **português** (sem acentos nos comentários e logs do código). Responda ao usuário em português.

## 2. Comandos
```bash
npm ci
npm run build                              # nest build
npx jest                                   # 241 unitarios (rootDir=src, *.spec.ts)
npm run test:e2e                           # 8 e2e (test/*.e2e-spec.ts, AppModule real com provider mockado)
npm run start:dev                          # watch
curl localhost:3010/health
```
Existe `scripts/smoke-meal-photo.mjs` (smoke do meal-photo; **não li nem executei**, confira o conteúdo antes de rodar). O plano gratuito do Gemini tem 5 req/min.

## 3. Mapa do código
```
src/
  main.ts                    # bootstrap: valida env, shutdown hooks, helmet, ValidationPipe global
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
    provider-errors.ts       # ProviderQuotaExceededException (503 + retryAfterSeconds)
    safe-token.ts            # so enums seguros vao para log/502
  common/
    auth/                    # InternalApiKeyGuard, ApiKeyRegistry (chave por app), RateLimiterService
    config/validate-env.ts   # validacao do env no boot
    http/retry-after.filter.ts
    logging/                 # middleware com request id; teste de que PII nao vaza nos logs
  health/                    # GET / e GET /health
```
Rotas: todas `POST /v1/adapters/<app>/<feature>/<acao>`. Lista completa: `grep -rn "@Post" src --include=*.controller.ts`.

Padrão de um adapter: DTO (class-validator) → prompt → `llmProvider.generateStructured(...)` com `responseSchema` + `validate` → resposta `{provider, version, model, generatedAt, ...dados}`. O LLM nunca devolve texto livre sem validação.

## 4. Regras que NÃO podem ser quebradas
1. **Identidade do app vem da chave** (`SELAH_APP_KEYS=App:chave`), nunca do header `X-Source-App`.
2. **Logs só com metadados** (tamanhos, tipos, latência, enums). Nunca conteúdo de nota, prompt, saída do modelo ou texto de erro do upstream. `no-personal-data-in-logs.spec.ts` guarda isso; adapter novo deve entrar nele.
3. **Erro do upstream nunca vai para log nem corpo de erro** (v2.7.2). Só status, código de rede e enums (`safe-token.ts`).
4. **Entrada do usuário é dado, não instrução**: delimitar no prompt (ver `<<<NOTA ... NOTA>>>` em psicologia) e remover o delimitador da própria entrada.
5. **Psicologia só recebe dado sintético** enquanto a chave do Gemini for do plano gratuito. O Selah **não anonimiza**; isso é do Notta.psi.
6. **Rate limit (429) é do Selah; cota do Gemini é 503** (v2.8.0). Não misture.
7. Mudou comportamento visível para consumidores? Bump de versão em `package.json`, nota em `docs/releases/vX.Y.Z.md` e linha no README.

## 5. Estado atual (v2.8.0)
- Build ok, **241 unitários e 8 e2e passando** (verificado nesta sessão).
- Entregue em 2.8.0: CI, shutdown gracioso (+ `stop_grace_period: 50s`), validação de env no boot, quota do Gemini como 503 + `Retry-After`. Detalhes e impacto em `docs/releases/v2.8.0.md`.
- Produção: Docker Compose (`docker-compose.prod.yml`) em `127.0.0.1:3020` atrás do nginx (`deploy/nginx/selah.conf`, `selah.financelumen.tech`). O `Dockerfile` já tem `HEALTHCHECK` e roda como usuário `node`.
- **Nada foi deployado nem pushado para `master` por esta sessão.** O trabalho está na branch `claude/charming-bohr-b00dys`.

## 6. Dívidas conhecidas (não resolvidas)
| Item | Detalhe |
|---|---|
| **Lint/prettier** | `eslint` reporta 817 erros (813 são formatação em 61 arquivos; 4 são `no-unused-vars` em `catch (_error)` no gemini provider e no lumen receipt-parser). Corrigir exige reformatar tudo em um commit só. No CI o lint é informativo. |
| **`npm audit`** | 10 vulnerabilidades (1 crítica, 4 altas) em dependências de produção via `express`/`qs`; a correção do audit exige `@nestjs/platform-express@12` (major). Não tentado. |
| **Rate limit em memória** | Vale para uma instância; zera a cada restart. Redis só se houver mais de uma réplica. |
| **Sem proteção contra provider lento** | Não há limite global de requisições em voo nem circuit breaker; Gemini lento = até 45 s por requisição acumulando. |
| **JSON inválido do Gemini → 502 direto** | Sem nova tentativa (só o Lumen tem retry próprio). |
| **Sem métricas** | Só logs. Sem `/metrics`, sem teto diário de tokens por app. |
| **Corpo de até 20 MB lido antes do guard** | O parser JSON é middleware global; requisição sem chave ainda é parseada. nginx limita em 20 MB. |
| **`X-Forwarded-For` no log** | Primeiro valor do header, forjável se alguém alcançar a porta direto. Só afeta log. Falta `trust proxy`. |
| **Psicologia** | Decisão pendente: rascunho **fiel** à nota ou **reescrito** (hoje sai do tamanho da nota). Não verificado: anamnese colada sem quebras de linha, autolesão em PSICANALISE, notas perto de 8.000 caracteres. |
| **Consumidores e o 503** | Não foi verificado como Lumen, PraiseApp, Agilis, BalancoGordura e Notta.psi tratam 503 (antes a cota era 502). |

## 7. Não verificado / não lido
- Os prompts e services de **Kids, Louvor, Consolidação, Relatórios, Lumen e Agilis** foram só mapeados por rotas, não lidos.
- Nada foi testado contra o **Gemini real** nesta sessão (só mocks e um Gemini falso local).
- O nginx e o compose de produção não foram executados.

## 8. Decisões de design discutidas (não implementadas)
- **RAG / MCP:** o dono não tem caso de uso hoje (apps são locais e pequenos). Se retomar: módulo `rag` **desligado por padrão**, interfaces `EmbeddingProvider` / `VectorStore` / `RetrievalService`, índice isolado por app (vem da chave de API), piloto em **PraiseApp Kids** (`next-sequence`), **sem MCP** na primeira fase. O `GeminiProvider` não tem function calling nem embeddings hoje. Fora de escopo: dados clínicos de psicologia.

## 9. Histórico
| Versão | O que entrou |
|---|---|
| 2.8.0 | CI, shutdown gracioso, validação de env no boot, quota do Gemini como 503 + `Retry-After` |
| 2.7.9 | Verificação com Gemini real do adapter psicologia (sem código) |
| 2.7.x | Psicologia: endurecimento do prompt, erro do upstream fora de log/502, `safe-token` |
| 2.6.x | BalancoGordura `meal-photo` |
| 2.5.x e antes | Ver `docs/releases/` |

## 10. Como atualizar este arquivo
Ao terminar uma sessão: ajuste a data/versão no topo, o "Estado atual", mova itens resolvidos para fora de "Dívidas", registre o que **não** foi verificado, e acrescente uma linha ao "Histórico". Escreva só o que você verificou; marque o resto como não verificado.
