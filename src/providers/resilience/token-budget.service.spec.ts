import { TokenBudgetExceededException } from '../provider-errors';
import { TokenBudgetService } from './token-budget.service';

const DAY = 24 * 60 * 60 * 1000;
const NOON = 20_000 * DAY + 12 * 60 * 60 * 1000; // meio-dia UTC de um dia qualquer

describe('TokenBudgetService', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sem teto configurado nunca bloqueia', () => {
    delete process.env.SELAH_DAILY_TOKEN_BUDGET;
    delete process.env.SELAH_TOKEN_BUDGETS;
    const service = new TokenBudgetService();
    service.record('LumenBack', 10_000_000, NOON);
    expect(() => service.assertAvailable('LumenBack', NOON)).not.toThrow();
  });

  it('bloqueia com 429 e Retry-After ate a virada do dia UTC quando o teto e atingido', () => {
    process.env.SELAH_DAILY_TOKEN_BUDGET = '1000';
    const service = new TokenBudgetService();
    service.record('LumenBack', 600, NOON);
    expect(() => service.assertAvailable('LumenBack', NOON)).not.toThrow();
    service.record('LumenBack', 400, NOON);

    let error: any;
    try {
      service.assertAvailable('LumenBack', NOON);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TokenBudgetExceededException);
    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toMatchObject({
      reason: 'DAILY_TOKEN_BUDGET_EXCEEDED',
      retryAfterSeconds: 12 * 60 * 60,
    });
  });

  it('o consumo e por app: um app no teto nao afeta os outros', () => {
    process.env.SELAH_DAILY_TOKEN_BUDGET = '100';
    const service = new TokenBudgetService();
    service.record('LumenBack', 100, NOON);
    expect(() => service.assertAvailable('LumenBack', NOON)).toThrow();
    expect(() => service.assertAvailable('PraiseAppBack', NOON)).not.toThrow();
  });

  it('SELAH_TOKEN_BUDGETS sobrescreve o padrao por app (0 libera aquele app)', () => {
    process.env.SELAH_DAILY_TOKEN_BUDGET = '100';
    process.env.SELAH_TOKEN_BUDGETS = 'LumenBack:5000,AgilisBack:0';
    const service = new TokenBudgetService();
    service.record('LumenBack', 1000, NOON);
    service.record('AgilisBack', 1_000_000, NOON);
    service.record('PraiseAppBack', 1000, NOON);

    expect(() => service.assertAvailable('LumenBack', NOON)).not.toThrow();
    expect(() => service.assertAvailable('AgilisBack', NOON)).not.toThrow();
    expect(() => service.assertAvailable('PraiseAppBack', NOON)).toThrow();
  });

  it('zera na virada do dia UTC', () => {
    process.env.SELAH_DAILY_TOKEN_BUDGET = '100';
    const service = new TokenBudgetService();
    service.record('LumenBack', 100, NOON);
    expect(() => service.assertAvailable('LumenBack', NOON)).toThrow();
    expect(() =>
      service.assertAvailable('LumenBack', NOON + DAY / 2 + 1000),
    ).not.toThrow();
    expect(service.usedToday('LumenBack', NOON + DAY)).toBe(0);
  });

  it('ignora contagens invalidas', () => {
    process.env.SELAH_DAILY_TOKEN_BUDGET = '100';
    const service = new TokenBudgetService();
    service.record('LumenBack', NaN, NOON);
    service.record('LumenBack', -5, NOON);
    expect(service.usedToday('LumenBack', NOON)).toBe(0);
  });

  it.each([
    ['SELAH_DAILY_TOKEN_BUDGET', 'muito'],
    ['SELAH_DAILY_TOKEN_BUDGET', '-1'],
    ['SELAH_TOKEN_BUDGETS', 'LumenBack'],
    ['SELAH_TOKEN_BUDGETS', 'LumenBack:abc'],
    ['SELAH_TOKEN_BUDGETS', ':100'],
  ])('lanca com %s=%s (o Selah nao sobe)', (name, value) => {
    process.env[name] = value;
    expect(() => new TokenBudgetService()).toThrow(name);
  });
});
