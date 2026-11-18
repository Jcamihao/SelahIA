import { isUpperEnum, pickUpperEnum } from './safe-token';

describe('safe-token', () => {
  describe('isUpperEnum', () => {
    it('aceita enums em maiusculas como os da Google e do Node', () => {
      for (const value of [
        'STOP',
        'MAX_TOKENS',
        'RESOURCE_EXHAUSTED',
        'ECONNRESET',
      ]) {
        expect(isUpperEnum(value)).toBe(true);
      }
    });

    it('rejeita texto livre, minusculas, tamanho fora de 3 a 40 e nao-string', () => {
      const rejected = [
        'stop',
        'AB',
        'A'.repeat(41),
        'TEXTO LIVRE',
        'NOTA-123',
        'COM\nQUEBRA',
        '',
        null,
        undefined,
        42,
        {},
      ];
      for (const value of rejected) {
        expect(isUpperEnum(value)).toBe(false);
      }
    });

    it('aceita exatamente 3 e 40 caracteres', () => {
      expect(isUpperEnum('A'.repeat(3))).toBe(true);
      expect(isUpperEnum('A'.repeat(40))).toBe(true);
    });
  });

  describe('pickUpperEnum', () => {
    it('devolve o enum valido e "unknown" para o resto', () => {
      expect(pickUpperEnum('MAX_TOKENS')).toBe('MAX_TOKENS');
      expect(pickUpperEnum('texto livre com SEGREDO')).toBe('unknown');
      expect(pickUpperEnum(undefined)).toBe('unknown');
    });
  });
});
