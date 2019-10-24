import { books } from './db';
import { LibContract, fragmentForPath } from 'booka-common';
import { createRouter } from 'booka-utils';
import { authOpt } from './auth';

export const router = createRouter<LibContract>();

router.get('/search', async ctx => {
    const query = ctx.query.query ?? '';
    const page = ctx.query.page ?? 0;

    const result = await books.search(query, page);

    return {
        success: {
            values: result,
            next: page + 1,
        },
    };
});

router.get('/fragment', async ctx => {
    const body = ctx.request.body;
    if (!body) {
        return { fail: 'Locator should be specified in body' };
    }

    const book = await books.byBookId(body.id);
    if (!book) {
        return { fail: 'Book not found' };
    }

    const fragment = fragmentForPath(book, body.path);
    return { success: fragment };
});

router.get('/full', async ctx => {
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

router.get('/all', async ctx => {
    const page = ctx.query.page ?? 0;
    const result = await books.all(page);

    return {
        success: {
            values: result,
            next: page + 1,
        },
    };
});

router.post('/upload', authOpt(async ctx => {
    if (!ctx.account) {
        return { fail: 'Not authorized' };
    }
    const book = ctx.request.files.book;
    if (book) {
        const bookId = await books.uploadEpub(book.path, ctx.account._id);
        return bookId
            ? { success: bookId }
            : { fail: `Couldn't parse book` };
    }

    return { fail: 'File is not attached' };
}));
