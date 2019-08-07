import { slugify } from 'transliteration';

export function transliterate(str: string) {
    const result = slugify(str, { allowedChars: 'a-zA-Z0-9-_' });
    return result;
}
