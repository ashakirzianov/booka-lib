import { books } from './db';
import { LibContract } from './libContract';
import { createRouter } from './common/router';

export const router = createRouter<LibContract>();

router.get('/single', async ctx => {
    if (ctx.query.id) {
        const book = await books.byBookId(ctx.query.id);
        return book
            ? {
                success: book,
            }
            : {
                fail: `Couldn't find book for id: '${ctx.query.id}'`,
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

router.post('/upload', async ctx => {
    const book = ctx.request.files.book;
    if (book) {
        const bookId = await books.parseAndInsert(book.path);
        return bookId
            ? { success: bookId }
            : { fail: `Couldn't parse book` };
    }

    return { fail: 'File is not attached' };
});
