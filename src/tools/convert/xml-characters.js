const legalXmlCharacter = cp => [9,10,13].includes(cp) || cp >= 0x20 && cp <= 0xD7FF ||
  cp >= 0xE000 && cp <= 0xFFFD || cp >= 0x10000 && cp <= 0x10FFFF;

export function validateXmlCharacterReferences(source) {
  for (const [reference, digits] of source.matchAll(/&#(?:(x[\da-fA-F]+|\d+);)?/g)) {
    const value = digits?.startsWith('x') ? Number.parseInt(digits.slice(1),16) : Number(digits);
    if (!legalXmlCharacter(value)) throw new Error('XML 数字字符引用无效或超出 XML 1.0 合法范围：'+reference.slice(0,32));
  }
}
