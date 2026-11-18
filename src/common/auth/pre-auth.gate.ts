import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ApiKeyRegistry } from './api-key-registry.service';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const logger = new Logger('SelahPreAuth');

// Roda ANTES do parser de corpo. O parser JSON e global e le ate SELAH_BODY_SIZE_LIMIT (20mb) de
// quem quer que chame; sem isso uma requisicao sem chave ainda faria o servidor ler e parsear 20mb
// antes do guard recusar. Aqui so confere se a chave existe: rate limit, identidade do app e o
// resto continuam no InternalApiKeyGuard. Sem chaves configuradas nao faz nada (mesma regra do guard).
export const createPreAuthGate =
  (registry: ApiKeyRegistry) =>
  (request: Request, response: Response, next: NextFunction) => {
    if (
      !BODY_METHODS.has(String(request.method || '').toUpperCase()) ||
      !registry.hasKeys()
    ) {
      return next();
    }

    const providedKey = String(request.headers['x-selah-api-key'] || '').trim();
    if (registry.authenticate(providedKey)) {
      return next();
    }

    logger.warn(
      'Chave de API ausente ou invalida; corpo descartado sem leitura.',
    );
    // Fecha a conexao: o corpo nao lido nao deve segurar o socket.
    response.setHeader('Connection', 'close');
    response.status(401).json({
      statusCode: 401,
      message: 'Invalid Selah IA API key.',
      error: 'Unauthorized',
    });
  };
