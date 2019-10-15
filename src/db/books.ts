import {
    Book, BookInfo, buildFileHash, buildBookHash, storeImages,
} from 'booka-common';
import { transliterate, filterUndefined } from '../utils';
import { logger } from '../log';
import { parseEpub } from 'booka-parser';
import { assets as s3assets } from '../assets';
import { assets as mongoAssets } from '../assets.mongo';
import { config } from '../config';
import { TypeFromSchema, model, paginate } from '../back-utils';

// TODO: remove mongo assets support
const assets = config().assets === 'mongo'
    ? mongoAssets
    : s3assets;

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
    license: String,
} as const;

export type DbBook = TypeFromSchema<typeof schema>;
const docs = model('Book', schema);

export const books = {
    byBookId,
    parseAndInsert,
    all,
    count,
    removeAll,
    infos,
};

async function byBookId(id: string) {
    const book = await docs.findOne({ bookId: id }).exec();
    if (!book || !book.jsonAssetId) {
        return undefined;
    }

    const json = await assets.downloadJson(book.jsonAssetId);
    if (json) {
        const parsed = JSON.parse(json);
        const contract = parsed as Book;

        return contract;
    } else {
        return undefined;
    }
}

async function parseAndInsert(filePath: string) {
    const processResult = await processFile(filePath);
    if (processResult.alreadyExist) {
        return processResult.bookId;
    }
    const { book, bookHash, fileHash } = processResult;

    const bookId = await generateBookId(book.meta.title, book.meta.author);

    const uploadResult = await uploadBookAsset(bookId, filePath, book);
    if (uploadResult) {
        const coverImage = book.meta.coverImage;
        const coverUrl = coverImage && coverImage.image === 'external'
            ? coverImage.url
            : undefined;
        const bookDocument: DbBook = {
            title: book.meta.title,
            author: book.meta.author,
            cover: coverUrl,
            jsonAssetId: uploadResult.jsonAssetId,
            originalAssetId: uploadResult.originalAssetId,
            bookId: bookId,
            bookHash,
            fileHash,
        };

        const inserted = await docs.insertMany(bookDocument);
        if (inserted) {
            logger().important('Inserted book for id: ' + bookId);
            return bookId;
        }
    }

    throw new Error(`Couldn't insert book for id: '${bookId}'`);
}

async function processFile(filePath: string) {
    const fileHash = await buildFileHash(filePath);
    const existingFile = await checkForFileDuplicates(fileHash);
    if (existingFile) {
        return {
            alreadyExist: true as const,
            bookId: existingFile.bookId,
        };
    }

    const parsingResult = await parseEpub({ filePath });
    if (!parsingResult.success) {
        throw new Error(`Couldn't parse book at path: '${filePath}'`);
    }

    const { book } = parsingResult.value;
    const bookHash = buildBookHash(book);
    const existingBook = await checkForBookDuplicates(bookHash);
    if (existingBook) {
        return {
            alreadyExist: true as const,
            bookId: existingBook.bookId,
        };
    }

    return {
        alreadyExist: false as const,
        book, bookHash, fileHash,
    };
}

async function uploadBookAsset(bookId: string, filePath: string, book: Book) {
    const resolvedBook = await uploadAndResolveBookImages(bookId, book);
    const jsonAssetId = await assets.uploadBookObject(bookId, book);
    if (jsonAssetId) {
        const originalAssetId = await assets.uploadOriginalFile(bookId, filePath);

        return {
            jsonAssetId, originalAssetId,
        };
    }

    return undefined;
}

async function uploadAndResolveBookImages(
    bookId: string,
    book: Book,
): Promise<Book> {
    const resolved = await storeImages(book, async (buffer, imageId) => {
        const imageBuffer = Buffer.from(buffer);
        const imageUrl = await assets.uploadBookImage(bookId, imageId, imageBuffer);

        return imageUrl;
    });
    return resolved;
}

async function all(page: number): Promise<BookInfo[]> {
    const bookMetas = await paginate(
        docs
            .find({}, ['title', 'author', 'bookId', 'cover']),
        page,
    ).exec();
    const allMetas = bookMetas.map(
        book => book.id
            ? {
                author: book.author,
                // TODO: better solution for missing title
                title: book.title || 'no-title',
                cover: book.cover,
                id: book.bookId,
                tags: [],
            }
            : undefined
    );

    return filterUndefined(allMetas);
}

async function infos(ids: string[]): Promise<BookInfo[]> {
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

async function checkForFileDuplicates(fileHash: string) {
    const matchFileHash = await docs.findOne({ fileHash }).exec();
    return matchFileHash
        ? matchFileHash
        : undefined;
}

async function checkForBookDuplicates(bookHash: string) {
    const matchBookHash = await docs.findOne({ bookHash }).exec();
    return matchBookHash
        ? matchBookHash
        : undefined;
}

async function count() {
    return docs.countDocuments().exec();
}

async function removeAll() {
    await docs.deleteMany({});
}

async function isBookExists(bookId: string): Promise<boolean> {
    const book = await docs.findOne({ bookId });
    return book !== null;
}

async function generateBookId(title?: string, author?: string): Promise<string> {
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
