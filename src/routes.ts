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

    const card = await books.card(id);
    const book = await books.byBookId(id);
    if (!book || !card) {
        return { fail: `Could not find book: ${id}` };
    }
    const fragment = fragmentForPath(book, path, defaultFragmentLength);
    return { success: { fragment, card } };
});

router.get('/full', async ctx => {
    if (ctx.query.id) {
        const card = await books.card(ctx.query.id);
        const book = await books.byBookId(ctx.query.id);
        return book && card
            ? { success: { book, card } }
            : { fail: `Couldn't find book for id: '${ctx.query.id}'` };
    } else {
        return { fail: 'Book id is not specified' };
    }
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

router.get('/card', async ctx => {
    const bookId = ctx.query.id;
    if (!bookId) {
        return { fail: 'Book id not specified' };
    }
    const card = await books.card(bookId);
    return card
        ? { success: card }
        : { fail: `Could not find card for id: ${bookId}` };
});

router.post('/card/batch', async ctx => {
    const body = ctx.request.body;
    if (!body) {
        return { fail: 'Book id be specified in body' };
    }
    const results = await Promise.all(body.map(async ({ id, previews }) => {
        const card = await books.card(id);
        if (card === undefined) {
            throw new Error(`Could not find card for id: ${id}`);
        }
        if (previews?.length) {
            const book = await books.byBookId(id);
            if (book === undefined) {
                throw new Error(`Could not find book for id: ${id}`);
            }
            const resolvedPreviews = previews.map(path => previewForPath(book, path));
            return {
                card,
                previews: resolvedPreviews,
            };
        } else {
            return { card, previews: [] };
        }
    }));
    return { success: results };
});
