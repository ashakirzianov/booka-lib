import { createHash } from 'crypto';
import { Book, extractNodeText } from 'booka-common';

export async function buildHash(book: Book) {
    const input = extractString(book);
    return createHash('sha1')
        .update(input)
        .digest('base64');
}

function extractString(book: Book): string {
    return extractNodeText(book.volume);
}
