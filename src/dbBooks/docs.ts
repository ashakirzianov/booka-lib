import {
    Book, LibraryCard, SearchResult, KnownTag,
} from 'booka-common';
import { TypeFromSchema, model, paginate, taggedObject } from 'booka-utils';
import { downloadStringAsset, Bucket } from '../assets';

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
    bookAlias: {
        type: String,
        index: true,
        required: true,
    },
    jsonBucketId: {
        type: String,
        required: true,
    },
    jsonAssetId: {
        type: String,
        required: true,
    },
    originalBucketId: String,
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
        type: [taggedObject<KnownTag>()],
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
    const book = await docs.findById(id).exec();
    if (!book || !book.jsonAssetId || !book.jsonBucketId) {
        return undefined;
    }

    return downloadBook(book.jsonAssetId, book.jsonBucketId as Bucket);
}

export async function card(bookId: string): Promise<LibraryCard | undefined> {
    const bookDb = await docs.findById(bookId);
    return bookDb
        ? {
            author: bookDb.author,
            // TODO: better solution for missing title
            title: bookDb.title || 'no-title',
            coverUrl: bookDb.cover,
            smallCoverUrl: bookDb.coverSmall,
            id: bookDb._id,
            alias: bookDb.bookAlias,
            tags: bookDb.tags as any[],
        }
        : undefined;
}

export async function count() {
    return docs.countDocuments().exec();
}

export async function search(query: string, page: number) {
    const q = { $regex: `.*${query}.*` };
    const result = await paginate(
        docs.find({
            $or: [
                { title: q },
                { author: q },
            ],
        }),
        page,
    ).exec();

    return result.map<SearchResult>(doc => {
        return {
            search: 'book',
            desc: {
                id: doc._id,
                alias: doc.bookAlias,
                title: doc.title ?? 'no-title',
                author: doc.author,
                coverUrl: doc.cover,
                smallCoverUrl: doc.coverSmall,
                tags: (doc.tags ?? []) as KnownTag[],
            },
        };
    });
}

const bookCache: {
    [k: string]: Book,
} = {};
async function downloadBook(assetId: string, bucket: Bucket) {
    const cached = bookCache[assetId];
    if (cached) {
        return cached;
    }

    const json = await downloadStringAsset(bucket, assetId);
    if (json) {
        const parsed = JSON.parse(json);
        const contract = parsed as Book;
        bookCache[assetId] = contract;

        return contract;
    } else {
        return undefined;
    }
}
