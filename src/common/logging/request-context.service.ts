import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type SelahRequestContext = {
  requestId: string;
  sourceApp: string;
  method: string;
  path: string;
  startedAt: number;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<SelahRequestContext>();

  run<T>(context: SelahRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get() {
    return this.storage.getStore();
  }

  getRequestId() {
    return this.get()?.requestId || 'n/a';
  }

  setSourceApp(sourceApp: string) {
    const store = this.get();
    if (store) {
      store.sourceApp = sourceApp;
    }
  }

  getSourceApp() {
    return this.get()?.sourceApp || 'unknown';
  }
}
