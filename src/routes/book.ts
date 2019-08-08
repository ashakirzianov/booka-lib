import { books } from '../db';
import * as KoaRouter from 'koa-router';
import { logTimeAsync, logger } from '../log';
import { loadEpubPath } from '../epub';
import { Book, BookCollection } from '../contracts';
import { jsonApi } from '../common';

export const bookRouter = new KoaRouter();

bookRouter.get('/id/:id',
    jsonApi<Book>(async p => {
        if (p.params.id) {
            const book = await books.byBookIdParsed(p.params.id);
            return book
                ? {
                    success: book,
                }
                : {
                    fail: `Couldn't find book for id: '${p.params.id}'`,
                };
        } else {
            return { fail: 'Book id is not specified' };
        }
    })
);

bookRouter.get('/all',
    jsonApi<BookCollection>(async () => {
        const allBooks = await books.all();

        return {
            success: {
                books: allBooks,
            },
        };
    })
);

bookRouter.post('/upload', jsonApi<string>(async p => {
    const files = p.files;
    const book = files && files.book;
    if (book) {
        const bookId = await parseAndInsert(book.path);
        return bookId
            ? { success: `Inserted with id: '${bookId}'` }
            : { fail: `Couldn't parse book` };
    }

    return { fail: 'File is not attached' };
}));

// TODO: move ?
async function parseAndInsert(fullPath: string) {
    try {
        const book = await logTimeAsync(
            `Parse: ${fullPath}`,
            () => loadEpubPath(fullPath)
        );
        return await books.insertParsed(book);
    } catch (e) {
        logger().warn(`While parsing '${fullPath}' error: ${e}`);
        return undefined;
    }
}
