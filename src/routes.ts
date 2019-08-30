import { books } from './db';
import { LibContract } from 'booka-common';
import { createRouter } from './back-utils';

export const router = createRouter<LibContract>();

router.get('/download', async ctx => {
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

router.get('/all', async ctx => {
    const page = ctx.query && ctx.query.page || 0;
    const allBooks = await books.all(page);

    return {
        success: {
            next: page + 1,
            values: allBooks,
        },
    };
});

router.get('/info', async ctx => {
    const ids = ctx.query.ids || [];
    const infos = await books.infos(ids);

    return { success: infos };
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
