import { ProviderUnavailableException } from '../provider-errors';

export type CircuitState = 'closed' | 'open' | 'half_open';

// Abre depois de `failureThreshold` falhas transitorias SEGUIDAS do provedor. Aberto, recusa na hora
// por `openMs`; depois deixa passar uma chamada de teste (half_open): se der certo fecha, se falhar
// reabre. threshold 0 desliga. Resposta invalida, 4xx e cota nao contam: o provedor esta no ar.
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private probeInFlight = false;

  constructor(
    private readonly failureThreshold: number,
    private readonly openMs: number,
    private readonly onStateChange: (state: CircuitState) => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  get currentState(): CircuitState {
    return this.state;
  }

  // Checagem barata antes de entrar na fila: nao muda estado.
  assertNotOpen() {
    if (this.failureThreshold <= 0) return;
    if (this.state === 'open' && this.remainingOpenMs() > 0) {
      throw new ProviderUnavailableException(this.remainingOpenMs() / 1000);
    }
  }

  // Chamada logo antes de falar com o provedor.
  beforeCall() {
    if (this.failureThreshold <= 0) return;

    if (this.state === 'open') {
      if (this.remainingOpenMs() > 0) {
        throw new ProviderUnavailableException(this.remainingOpenMs() / 1000);
      }
      this.transition('half_open');
    }

    if (this.state === 'half_open') {
      if (this.probeInFlight) {
        throw new ProviderUnavailableException(1);
      }
      this.probeInFlight = true;
    }
  }

  onSuccess() {
    if (this.failureThreshold <= 0) return;
    this.failures = 0;
    this.probeInFlight = false;
    if (this.state !== 'closed') {
      this.transition('closed');
    }
  }

  onTransientFailure() {
    if (this.failureThreshold <= 0) return;
    this.probeInFlight = false;

    if (this.state === 'half_open') {
      this.open();
      return;
    }

    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.open();
    }
  }

  private open() {
    this.openedAt = this.now();
    this.transition('open');
  }

  private remainingOpenMs() {
    return Math.max(0, this.openedAt + this.openMs - this.now());
  }

  private transition(next: CircuitState) {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange(next);
  }
}
