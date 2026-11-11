import { ProviderBusyException } from '../provider-errors';

type Waiter = { grant: () => void; timer: NodeJS.Timeout };

// Limita chamadas simultaneas ao LLM. Acima do limite entra numa fila curta; fila cheia ou espera
// longa demais vira 503 (PROVIDER_BUSY) em vez de acumular requisicoes de ate 45s cada.
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  // max 0 desliga o limite.
  constructor(
    private readonly max: number,
    private readonly maxQueue: number,
    private readonly queueTimeoutMs: number,
  ) {}

  get inFlight() {
    return this.active;
  }

  get queued() {
    return this.waiters.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.max <= 0) {
      return task();
    }

    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve();
    }

    if (this.waiters.length >= this.maxQueue) {
      return Promise.reject(new ProviderBusyException());
    }

    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        grant: resolve,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index !== -1) {
            this.waiters.splice(index, 1);
          }
          reject(new ProviderBusyException());
        }, this.queueTimeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  // Passa a vaga direto para o proximo da fila (active nao muda) ou libera.
  private release() {
    const next = this.waiters.shift();
    if (next) {
      clearTimeout(next.timer);
      next.grant();
      return;
    }
    this.active -= 1;
  }
}
