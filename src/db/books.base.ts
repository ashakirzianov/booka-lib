import {
    Book, BookDesc,
} from 'booka-common';
import { transliterate, filterUndefined } from '../utils';
import { downloadStringAsset } from '../assets';
import { TypeFromSchema, model, paginate } from '../back-utils';

const schema = {
    author: {
        type: String,
        index: true,
    },
    title: {
        type: String,
        index: true,
    },
    cover: String,
    coverSmall: String,
    bookId: {
        type: String,
        index: true,
        required: true,
    },
    jsonAssetId: {
        type: String,
        required: true,
    },
    originalAssetId: String,
    fileHash: {
        type: String,
        required: true,
    },
    bookHash: {
        type: String,
        required: true,
    },
    license: {
        type: String,
        required: true,
    },
    tags: {
        type: [Object],
        required: true,
    },
    textLength: {
        type: Number,
        required: true,
    },
    private: Boolean,
} as const;

export type DbBook = TypeFromSchema<typeof schema>;
export const docs = model('Book', schema);

export async function byBookId(id: string) {
    const book = await docs.findOne({ bookId: id }).exec();
    if (!book || !book.jsonAssetId) {
        return undefined;
    }

    const json = await downloadStringAsset('booka-lib-json', book.jsonAssetId);
    if (json) {
        const parsed = JSON.parse(json);
        const contract = parsed as Book;

        return contract;
    } else {
        return undefined;
    }
}

export async function all(page: number): Promise<BookDesc[]> {
    const bookMetas = await paginate(
        docs
            .find({}, ['title', 'author', 'bookId', 'cover', 'coverSmall', 'license', 'tags']),
        page,
    ).exec();
    const allMetas = bookMetas.map(
        (bookDb): BookDesc | undefined => bookDb.id
            ? {
                author: bookDb.author,
                // TODO: better solution for missing title
                title: bookDb.title || 'no-title',
                coverUrl: bookDb.cover,
                smallCoverUrl: bookDb.coverSmall,
                id: bookDb.bookId,
                tags: bookDb.tags as any[],
            }
            : undefined
    );

    return filterUndefined(allMetas);
}

export async function infos(ids: string[]): Promise<BookDesc[]> {
    const result = await docs
        .find({ id: { $in: ids } })
        .exec();

    return result.map(r => ({
        id: r.bookId,
        tags: [],
        author: r.author,
        // TODO: better solution for missing title
        title: r.title || 'no-title',
        cover: r.cover,
    }));
}

export async function count() {
    return docs.countDocuments().exec();
}

async function isBookExists(bookId: string): Promise<boolean> {
    const book = await docs.findOne({ bookId });
    return book !== null;
}

export async function generateBookId(title?: string, author?: string): Promise<string> {
    // TODO: better solution for missing title
    for (const bookId of bookIdCandidate(title || 'no-title', author)) {
        if (!await isBookExists(bookId)) {
            return bookId;
        }
    }

    throw new Error('Could not generate book id');
}

function* bookIdCandidate(title: string, author?: string) {
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
