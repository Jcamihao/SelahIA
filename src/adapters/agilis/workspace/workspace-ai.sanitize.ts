// Texto livre de comentarios pode trazer contato e documento de pessoas; mascara antes de ir ao modelo.
export const sanitizeFreeText = (value: unknown, maxLength = 300) =>
  String(value ?? '')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-mail removido]')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[cnpj removido]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf removido]')
    .replace(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g, '[telefone removido]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
