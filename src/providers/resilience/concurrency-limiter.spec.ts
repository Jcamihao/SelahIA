import { ProviderBusyException } from '../provider-errors';
import { ConcurrencyLimiter } from './concurrency-limiter';

const deferred = () => {
  let resolve!: (value?: unknown) => void;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

describe('ConcurrencyLimiter', () => {
  afterEach(() => jest.useRealTimers());

  it('max 0 desliga o limite', async () => {
    const limiter = new ConcurrencyLimiter(0, 0, 1000);
    const gates = [deferred(), deferred(), deferred()];
    const runs = gates.map((gate) => limiter.run(() => gate.promise));
    expect(limiter.inFlight).toBe(0);
    gates.forEach((gate) => gate.resolve());
    await Promise.all(runs);
  });

  it('nunca passa de max chamadas simultaneas e atende a fila em ordem', async () => {
    const limiter = new ConcurrencyLimiter(2, 5, 1000);
    const order: number[] = [];
    const gates = [deferred(), deferred(), deferred(), deferred()];
    const runs = gates.map((gate, index) =>
      limiter.run(async () => {
        order.push(index);
        await gate.promise;
      }),
    );
    await Promise.resolve();

    expect(limiter.inFlight).toBe(2);
    expect(limiter.queued).toBe(2);
    expect(order).toEqual([0, 1]);

    gates[0].resolve();
    await runs[0];
    await Promise.resolve();
    expect(order).toEqual([0, 1, 2]);
    expect(limiter.inFlight).toBe(2);

    gates.forEach((gate) => gate.resolve());
    await Promise.all(runs);
    expect(limiter.inFlight).toBe(0);
    expect(limiter.queued).toBe(0);
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it('fila cheia responde 503 PROVIDER_BUSY na hora', async () => {
    const limiter = new ConcurrencyLimiter(1, 1, 1000);
    const gate = deferred();
    const first = limiter.run(() => gate.promise);
    const second = limiter.run(() => gate.promise);
    await Promise.resolve();

    await expect(limiter.run(async () => 'x')).rejects.toBeInstanceOf(
      ProviderBusyException,
    );
    gate.resolve();
    await Promise.all([first, second]);
  });

  it('espera longa demais na fila vira PROVIDER_BUSY e libera o lugar da fila', async () => {
    jest.useFakeTimers();
    const limiter = new ConcurrencyLimiter(1, 3, 500);
    const gate = deferred();
    const first = limiter.run(() => gate.promise);
    const waiting = limiter.run(async () => 'nunca roda');
    const assertion = expect(waiting).rejects.toBeInstanceOf(
      ProviderBusyException,
    );

    await jest.advanceTimersByTimeAsync(501);
    await assertion;
    expect(limiter.queued).toBe(0);

    gate.resolve();
    await first;
    expect(limiter.inFlight).toBe(0);
  });

  it('libera a vaga quando a tarefa falha', async () => {
    const limiter = new ConcurrencyLimiter(1, 1, 1000);
    await expect(
      limiter.run(async () => {
        throw new Error('falhou');
      }),
    ).rejects.toThrow('falhou');
    expect(limiter.inFlight).toBe(0);
    await expect(limiter.run(async () => 'ok')).resolves.toBe('ok');
  });
});
