import { isUpperEnum, pickReasonToken, pickUpperEnum } from './safe-token';

describe('safe-token', () => {
  describe('isUpperEnum', () => {
    it('aceita enums em maiusculas como os da Google e do Node', () => {
      for (const value of ['STOP', 'MAX_TOKENS', 'RESOURCE_EXHAUSTED', 'ECONNRESET']) {
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

  describe('pickReasonToken', () => {
    it('aceita valores do Ollama em minusculas, com ou sem underscore', () => {
      for (const value of ['stop', 'length', 'load', 'unload', 'Stop', 'max_tokens']) {
        expect(pickReasonToken(value)).toBe(value);
      }
    });

    it('troca por "unknown" o que tiver espaco, digito, simbolo, quebra de linha ou 41+ caracteres', () => {
      const rejected = [
        'texto livre SEGREDO',
        'stop2',
        'stop!',
        'stop\nSEGREDO',
        'a'.repeat(41),
        '',
        null,
        undefined,
        7,
      ];
      for (const value of rejected) {
        expect(pickReasonToken(value)).toBe('unknown');
      }
    });

    it('aceita exatamente 1 e 40 caracteres', () => {
      expect(pickReasonToken('a')).toBe('a');
      expect(pickReasonToken('a'.repeat(40))).toBe('a'.repeat(40));
    });
  });
});
