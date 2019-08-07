import { books } from '../db';
import * as Contracts from '../contracts';
import { createRouter, jsonApi } from './router';
import { logTimeAsync, logger } from '../log';
import { loadEpubPath } from '../epub';

export const bookRouter = createRouter();

bookRouter.get('/id/:id',
    jsonApi<Contracts.VolumeNode>(async p => {
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
    jsonApi<Contracts.BookCollection>(async () => {
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
