import { Model, Document, Schema, model } from 'mongoose';
import { TypeFromSchema } from './mongooseMapper';
import { transliterate, filterUndefined } from '../utils';
import { ParsedBook } from '../common';
import { logger } from '../log';

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
    raw: {
        type: String,
    },
};

export type Book = TypeFromSchema<typeof schema>;
type BookDocument = Book & Document;

const BookSchema = new Schema(schema, { timestamps: true });
const BookCollection: Model<BookDocument> = model<BookDocument>('Book', BookSchema);

export const books = {
    byBookIdParsed,
    insertParsed,
    all,
    count,
    removeAll,
};

async function byBookIdParsed(id: string) {
    const book = await BookCollection.findOne({ bookId: id }).exec();
    if (!book || !book.raw) {
        return undefined;
    }
    const parsed = JSON.parse(book.raw);
    const contract = parsed as ParsedBook;

    return contract;
}

async function insertParsed(book: ParsedBook) {
    const bookId = await generateBookId(book.meta.title, book.meta.author);
    const bookDocument: Book = {
        title: book.meta.title,
        author: book.meta.author,
        raw: JSON.stringify(book),
        bookId: bookId,
    };

    const inserted = await BookCollection.insertMany(bookDocument);
    if (inserted) {
        logger().important('Inserted book for id: ' + bookId);
        return bookId;
    } else {
        throw new Error(`Couldn't insert book for id: '${bookId}'`);
    }
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
