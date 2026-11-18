import { readRequiredString, readStringArray } from './read-fields';

describe('read-fields', () => {
  describe('readRequiredString', () => {
    it('apara, corta no tamanho maximo e aceita numero diferente de zero', () => {
      expect(readRequiredString({ a: ' oi ' }, 'a')).toBe('oi');
      expect(readRequiredString({ a: '  abcdef  ' }, 'a', 3)).toBe('abc');
      expect(readRequiredString({ a: 42 }, 'a')).toBe('42');
    });

    it.each([undefined, null, '', '  ', 0, false, NaN])(
      'lanca para %p, citando a chave',
      (valor) => {
        expect(() => readRequiredString({ campo: valor }, 'campo')).toThrow(
          'Campo obrigatório ausente: campo',
        );
      },
    );
  });

  describe('readStringArray', () => {
    it('descarta vazios e valores falsos, apara e limita itens e tamanho', () => {
      const lista = [' a ', '', null, 0, false, 'bbbbbb', 'c', 'd'];
      expect(readStringArray({ l: lista }, 'l', 3, 4)).toEqual([
        'a',
        'bbbb',
        'c',
      ]);
    });

    it.each([undefined, 'texto', 5, {}])('%p que nao e lista vira []', (v) => {
      expect(readStringArray({ l: v }, 'l')).toEqual([]);
    });

    it('lanca quando sobram menos itens que minItems', () => {
      expect(() => readStringArray({ l: ['', null] }, 'l', 6, 300, 1)).toThrow(
        'Campo obrigatório ausente: l',
      );
      expect(readStringArray({ l: ['x'] }, 'l', 6, 300, 1)).toEqual(['x']);
    });
  });
});
