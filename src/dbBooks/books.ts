import {
    LibraryCard, SearchResult, KnownTag,
} from 'booka-common';
import { paginate } from '../utils';
import { Bucket } from '../assets';
import { uploads } from '../dbUploads';
import { docs } from './docs';
import { downloadBook } from './storage';
import { parseAndInsert } from './parse';

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
            length: bookDb.textLength,
        }
        : undefined;
}

export async function cards(bookIds: string[]) {
    return Promise.all(
        bookIds.map(bookId => card(bookId))
    );
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
                length: doc.textLength,
            },
        };
    });
}

export async function uploadEpub({
    filePath, publicDomain, accountId,
}: {
    filePath: string,
    publicDomain: boolean,
    accountId: string,
}) {
    const bookId = await parseAndInsert(filePath, publicDomain);
    await uploads.addUpload(accountId, bookId);
    return bookId;
}
