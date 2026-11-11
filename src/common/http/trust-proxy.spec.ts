import { DEFAULT_TRUST_PROXY, parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('vazio usa o padrao (loopback e faixas privadas)', () => {
    expect(parseTrustProxy('')).toEqual(['loopback', 'uniquelocal']);
    expect(parseTrustProxy(undefined)).toEqual(DEFAULT_TRUST_PROXY.split(','));
  });

  it.each([['false'], ['off'], ['0']])('%s desliga', (value) => {
    expect(parseTrustProxy(value)).toBe(false);
  });

  it('numero e quantidade de saltos', () => {
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('aceita palavras-chave, IPs e CIDRs', () => {
    expect(parseTrustProxy('loopback, 10.0.0.0/8, 172.18.0.1, ::1')).toEqual([
      'loopback',
      '10.0.0.0/8',
      '172.18.0.1',
      '::1',
    ]);
  });

  it.each([['true'], ['qualquer coisa'], ['loopback;uniquelocal']])(
    'rejeita %s (true reabriria a falsificacao de X-Forwarded-For)',
    (value) => {
      expect(parseTrustProxy(value)).toBeInstanceOf(Error);
    },
  );
});
