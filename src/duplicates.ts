import { createHash } from 'crypto';
import { VolumeNode } from 'booka-common';

export async function buildHash(book: VolumeNode) {
    const input = extractString(book);
    return createHash('sha1')
        .update(input)
        .digest('base64');
}

function extractString(book: VolumeNode): string {
    return JSON.stringify(book);
}
