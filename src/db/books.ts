import { Model, Document, Schema, model } from 'mongoose';
import { TypeFromSchema } from '../common/mongooseUtils';
import { transliterate, filterUndefined } from '../utils';
import { BookObject } from '../common/bookFormat';
import { logger } from '../log';
import { loadEpubPath } from 'booka-parser';
import { uploadBookObject, uploadOriginalFile, downloadJson } from '../assets.mongo';
import { buildHash } from '../duplicates';

const schema = {
    author: {
        type: String,
        index: true,
    },
    title: {
        type: String,
        index: true,
        required: true,
    },
    bookId: {
        type: String,
        index: true,
        required: true,
    },
    jsonUrl: {
        type: String,
        required: true,
    },
    originalUrl: {
        type: String,
    },
    hash: {
        type: String,
        required: true,
    },
};

export type DbBook = TypeFromSchema<typeof schema>;
type BookDocument = DbBook & Document;

const BookSchema = new Schema(schema, { timestamps: true });
const BookCollection: Model<BookDocument> = model<BookDocument>('Book', BookSchema);

export const books = {
    byBookId,
    parseAndInsert,
    all,
    count,
    removeAll,
};

async function byBookId(id: string) {
    const book = await BookCollection.findOne({ bookId: id }).exec();
    if (!book || !book.jsonUrl) {
        return undefined;
    }

    const json = await downloadJson(book.jsonUrl);
    if (json) {
        const parsed = JSON.parse(json);
        const contract = parsed as BookObject;

        return contract;
    } else {
        return undefined;
    }
}

async function parseAndInsert(filePath: string) {
    const book = await loadEpubPath(filePath);
    const duplicate = await checkForDuplicates(book);
    if (duplicate.exist) {
        return duplicate.document.bookId;
    }

    const bookId = await generateBookId(book.meta.title, book.meta.author);

    const jsonRemotePath = await uploadBookObject(bookId, book);
    if (jsonRemotePath) {
        const originalRemotePath = await uploadOriginalFile(filePath);
        const bookDocument: DbBook = {
            title: book.meta.title,
            author: book.meta.author,
            jsonUrl: jsonRemotePath,
            originalUrl: originalRemotePath,
            bookId: bookId,
            hash: duplicate.hash,
        };

        const inserted = await BookCollection.insertMany(bookDocument);
        if (inserted) {
            logger().important('Inserted book for id: ' + bookId);
            return bookId;
        }
    }

    throw new Error(`Couldn't insert book for id: '${bookId}'`);
}

async function all() {
    const bookMetas = await BookCollection
        .find({}, ['title', 'author', 'bookId'])
        .exec();
    const allMetas = bookMetas.map(
        book => book.id
            ? {
                author: book.author,
                title: book.title,
                id: book.bookId,
            }
            : undefined
    );

    return filterUndefined(allMetas);
}

async function checkForDuplicates(book: BookObject) {
    const hash = await buildHash(book);
    const existing = await BookCollection.findOne({ hash }).exec();

    if (existing) {
        return {
            exist: true as const,
            document: existing,
        };
    } else {
        return {
            exist: false as const,
            hash,
        };
    }
}

async function count() {
    return BookCollection.countDocuments().exec();
}

async function removeAll() {
    await BookCollection.deleteMany({});
}

async function isBookExists(bookId: string): Promise<boolean> {
    const book = await BookCollection.findOne({ bookId });
    return book !== null;
}

async function generateBookId(title: string, author?: string): Promise<string> {
    for (const bookId of bookIdCandidate(title, author)) {
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
