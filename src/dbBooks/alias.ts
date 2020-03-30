import { slugify } from 'transliteration';
import { docs } from './docs';

export async function generateBookAlias(title?: string, author?: string): Promise<string> {
    // TODO: better solution for missing title
    for (const bookId of bookAliasCandidate(title || 'no-title', author)) {
        if (!await isBookExists(bookId)) {
            return bookId;
        }
    }

    throw new Error('Could not generate book id');
}

async function isBookExists(bookId: string): Promise<boolean> {
    const book = await docs.findOne({ bookId });
    return book !== null;
}

function* bookAliasCandidate(title: string, author?: string) {
    let candidate = transliterate(title);
    yield candidate;
    if (author) {
        candidate = transliterate(candidate + '-' + author);
        yield candidate;
    }

    for (let i = 0; true; i++) {
        yield candidate + '-' + i.toString();
    }
}

function transliterate(str: string) {
    const result = slugify(str, { allowedChars: 'a-zA-Z0-9-_' });
    return result;
}
