import { books } from './db';
import {
    LibContract, fragmentForPath, previewForPath,
    firstPath, pathFromString, defaultFragmentLength,
} from 'booka-common';
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
    const id = ctx.query.id;
    if (!id) {
        return { fail: 'Book id is not specified' };
    }

    const pathString = ctx.query.path;
    const path = pathString === undefined
        ? firstPath()
        : pathFromString(pathString) ?? firstPath();

    const book = await books.byBookId(id);
    if (!book) {
        return { fail: `Could not find book: ${id}` };
    }
    const fragment = fragmentForPath(book, path, defaultFragmentLength);
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
    // TODO: fix this nonsense
    const pageString = (ctx.query && ctx.query.page as any as string) || '0';
    const page = parseInt(pageString, 10) ?? 0;
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

router.post('/previews', async ctx => {
    const locators = ctx.request.body;
    if (!locators) {
        return { fail: 'Locators should be specified in body' };
    }

    const results = await Promise.all(
        locators.map(async l => {
            const book = await books.byBookId(l.id);
            if (!book) {
                return undefined;
            }
            const preview = previewForPath(book, l.path);
            return preview;
        })
    );

    return { success: results };
});
