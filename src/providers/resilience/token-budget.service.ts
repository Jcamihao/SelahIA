import { Injectable } from '@nestjs/common';
import { parseAppLimitList } from '../../common/config/app-limits';
import { TokenBudgetExceededException } from '../provider-errors';

const DAY_MS = 24 * 60 * 60 * 1000;

const utcDay = (now: number) => Math.floor(now / DAY_MS);

// Teto diario de tokens por app (soma de prompt + saida + raciocinio, como o Gemini reporta).
// Em memoria: zera na virada do dia UTC e a cada restart, como o rate limit. 0 desliga.
// Confere ANTES da chamada e soma DEPOIS, entao chamadas ja em andamento podem passar um pouco do teto.
@Injectable()
export class TokenBudgetService {
  private readonly defaultBudget: number;
  private readonly overrides: Map<string, number>;
  private readonly usage = new Map<string, { day: number; tokens: number }>();

  constructor() {
    const raw = String(process.env.SELAH_DAILY_TOKEN_BUDGET ?? '').trim();
    const value = raw ? Number(raw) : 0;
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(
        `SELAH_DAILY_TOKEN_BUDGET invalido: "${raw}" (esperado inteiro >= 0).`,
      );
    }
    this.defaultBudget = value;
    this.overrides = parseAppLimitList(
      process.env.SELAH_TOKEN_BUDGETS,
      'SELAH_TOKEN_BUDGETS',
    );
  }

  budgetFor(app: string) {
    return this.overrides.get(app) ?? this.defaultBudget;
  }

  usedToday(app: string, now = Date.now()) {
    const entry = this.usage.get(app);
    return entry && entry.day === utcDay(now) ? entry.tokens : 0;
  }

  assertAvailable(app: string, now = Date.now()) {
    const budget = this.budgetFor(app);
    if (budget <= 0 || this.usedToday(app, now) < budget) {
      return;
    }
    const nextDayMs = (utcDay(now) + 1) * DAY_MS;
    throw new TokenBudgetExceededException((nextDayMs - now) / 1000);
  }

  record(app: string, tokens: number, now = Date.now()) {
    if (!Number.isFinite(tokens) || tokens <= 0) return;
    this.usage.set(app, {
      day: utcDay(now),
      tokens: this.usedToday(app, now) + tokens,
    });
  }
}
