import { Injectable, Logger } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

export type AuthenticatedCaller =
  | { kind: 'app'; app: string; bucketId: string }
  | { kind: 'legacy'; bucketId: string };

const APP_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const MIN_RECOMMENDED_KEY_LENGTH = 32;
const KNOWN_DEV_KEY = 'selah-dev-key';

const sha256 = (value: string) => createHash('sha256').update(value).digest();

export const parseList = (raw: string | undefined) =>
  String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

@Injectable()
export class ApiKeyRegistry {
  private readonly logger = new Logger(ApiKeyRegistry.name);
  private readonly appKeys: Array<{ app: string; digest: Buffer }> = [];
  private readonly legacyKeys: Array<{ id: string; digest: Buffer }> = [];

  constructor() {
    const isProduction =
      String(process.env.NODE_ENV || '').trim() === 'production';
    const seen = new Map<string, string>();

    parseList(process.env.SELAH_APP_KEYS).forEach((entry, index) => {
      const separator = entry.indexOf(':');
      const app = separator > 0 ? entry.slice(0, separator).trim() : '';
      const key = separator > 0 ? entry.slice(separator + 1).trim() : '';
      if (!APP_NAME_PATTERN.test(app) || !key) {
        throw new Error(
          `SELAH_APP_KEYS invalido na entrada ${index + 1}: esperado App:chave (o nome so aceita letras, numeros, ponto, hifen e underscore).`,
        );
      }
      if (isProduction && key === KNOWN_DEV_KEY) {
        throw new Error('SELAH_APP_KEYS usa a chave de desenvolvimento em producao.');
      }
      const previousApp = seen.get(key);
      if (previousApp && previousApp !== app) {
        throw new Error(
          `SELAH_APP_KEYS invalido: a mesma chave esta atribuida a "${previousApp}" e "${app}".`,
        );
      }
      seen.set(key, app);
      if (key.length < MIN_RECOMMENDED_KEY_LENGTH) {
        this.logger.warn(
          `A chave de "${app}" tem menos de ${MIN_RECOMMENDED_KEY_LENGTH} caracteres. Gere uma nova com: openssl rand -hex 32`,
        );
      }
      this.appKeys.push({ app, digest: sha256(key) });
    });

    parseList(process.env.SELAH_INTERNAL_API_KEYS).forEach((key) => {
      if (isProduction && key === KNOWN_DEV_KEY) {
        throw new Error(
          'SELAH_INTERNAL_API_KEYS usa a chave de desenvolvimento em producao.',
        );
      }
      const digest = sha256(key);
      this.legacyKeys.push({ id: digest.toString('hex').slice(0, 12), digest });
    });

    if (this.legacyKeys.length) {
      this.logger.warn(
        'SELAH_INTERNAL_API_KEYS (legado) esta ativa: essas chaves nao identificam o app e dependem do header X-Source-App. Migre para SELAH_APP_KEYS e remova a variavel.',
      );
    }
  }

  hasKeys() {
    return this.appKeys.length > 0 || this.legacyKeys.length > 0;
  }

  authenticate(providedKey: string): AuthenticatedCaller | null {
    if (!providedKey) {
      return null;
    }

    const digest = sha256(providedKey);
    let caller: AuthenticatedCaller | null = null;

    // Percorre todas as chaves sem sair no primeiro acerto, para nao vazar posicao por tempo.
    for (const entry of this.appKeys) {
      if (timingSafeEqual(entry.digest, digest) && !caller) {
        caller = { kind: 'app', app: entry.app, bucketId: `app:${entry.app}` };
      }
    }
    for (const entry of this.legacyKeys) {
      if (timingSafeEqual(entry.digest, digest) && !caller) {
        caller = { kind: 'legacy', bucketId: `legacy:${entry.id}` };
      }
    }

    return caller;
  }
}
