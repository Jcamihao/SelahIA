import { ProviderUnavailableException } from '../provider-errors';
import { CircuitBreaker, CircuitState } from './circuit-breaker';

const setup = (threshold = 3, openMs = 1000) => {
  let now = 10_000;
  const changes: CircuitState[] = [];
  const breaker = new CircuitBreaker(
    threshold,
    openMs,
    (state) => changes.push(state),
    () => now,
  );
  return {
    breaker,
    changes,
    advance: (ms: number) => (now += ms),
  };
};

const failOnce = (breaker: CircuitBreaker) => {
  breaker.beforeCall();
  breaker.onTransientFailure();
};

describe('CircuitBreaker', () => {
  it('abre so depois de N falhas transitorias seguidas', () => {
    const { breaker, changes } = setup(3);
    failOnce(breaker);
    failOnce(breaker);
    expect(breaker.currentState).toBe('closed');
    failOnce(breaker);
    expect(breaker.currentState).toBe('open');
    expect(changes).toEqual(['open']);
  });

  it('um sucesso no meio zera a contagem', () => {
    const { breaker } = setup(3);
    failOnce(breaker);
    failOnce(breaker);
    breaker.beforeCall();
    breaker.onSuccess();
    failOnce(breaker);
    failOnce(breaker);
    expect(breaker.currentState).toBe('closed');
  });

  it('aberto, recusa com PROVIDER_UNAVAILABLE e Retry-After do tempo que falta', () => {
    const { breaker, advance } = setup(1, 30_000);
    failOnce(breaker);
    advance(10_000);

    expect(() => breaker.assertNotOpen()).toThrow(ProviderUnavailableException);
    const error: any = (() => {
      try {
        breaker.beforeCall();
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ProviderUnavailableException);
    expect(error.getResponse()).toMatchObject({
      reason: 'PROVIDER_UNAVAILABLE',
      retryAfterSeconds: 20,
    });
  });

  it('depois do tempo deixa passar so UMA chamada de teste; sucesso fecha', () => {
    const { breaker, advance, changes } = setup(1, 1000);
    failOnce(breaker);
    advance(1001);

    breaker.beforeCall();
    expect(breaker.currentState).toBe('half_open');
    expect(() => breaker.beforeCall()).toThrow(ProviderUnavailableException);

    breaker.onSuccess();
    expect(breaker.currentState).toBe('closed');
    expect(changes).toEqual(['open', 'half_open', 'closed']);
    expect(() => breaker.beforeCall()).not.toThrow();
  });

  it('falha na chamada de teste reabre por mais openMs', () => {
    const { breaker, advance } = setup(1, 1000);
    failOnce(breaker);
    advance(1001);
    breaker.beforeCall();
    breaker.onTransientFailure();

    expect(breaker.currentState).toBe('open');
    expect(() => breaker.assertNotOpen()).toThrow(ProviderUnavailableException);
    advance(1001);
    expect(() => breaker.assertNotOpen()).not.toThrow();
  });

  it('threshold 0 desliga o circuit breaker', () => {
    const { breaker } = setup(0);
    for (let i = 0; i < 20; i++) failOnce(breaker);
    expect(breaker.currentState).toBe('closed');
    expect(() => breaker.assertNotOpen()).not.toThrow();
  });
});
