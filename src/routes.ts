import { parseAndInsert, books } from './db';
import { LibraryContract } from './contracts';
import { createRouter } from './common';

export const router = createRouter<LibraryContract>();

router.get('/id/:id', async p => {
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
});

router.get('/all', async () => {
    const allBooks = await books.all();

    return {
        success: {
            books: allBooks,
        },
    };
});

router.post('/upload', async p => {
    const files = p.files;
    const book = files && files.book;
    if (book) {
        const bookId = await parseAndInsert(book.path);
        return bookId
            ? { success: `Inserted with id: '${bookId}'` }
            : { fail: `Couldn't parse book` };
    }

    return { fail: 'File is not attached' };
});
