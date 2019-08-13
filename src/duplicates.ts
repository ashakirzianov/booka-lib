import { createHash } from 'crypto';
import { BookObject } from './common/bookFormat';

export async function buildHash(book: BookObject) {
    const input = extractString(book);
    return createHash('sha1')
        .update(input)
        .digest('base64');
}

function extractString(book: BookObject): string {
    return JSON.stringify(book);
}
