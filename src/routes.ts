import { books } from './dbBooks';
import {
    LibContract, fragmentForPath, previewForPath,
    firstPath, pathFromString, defaultFragmentLength, nodePath,
} from 'booka-common';
import { createRouter } from './utils';
import { authOpt } from './auth';
import { uploads } from './dbUploads';
import { downloads } from './dbDownloads';

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

router.get('/preview', async ctx => {
    const bookId = ctx.query.bookId;
    const node = ctx.query.node;
    if (bookId && node !== undefined) {
        const book = await books.byBookId(bookId);
        if (book) {
            const preview = previewForPath(book, nodePath(node));
            return { success: { preview } };
        } else {
            return { fail: `Couldn't find book for id: ${bookId}` };
        }
    } else {
        return { fail: 'Book id or node are not specified' };
    }
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
    const bookId = ctx.query.id;
    if (bookId) {
        const card = await books.card(bookId);
        const book = await books.byBookId(bookId);
        if (book && card) {
            downloads.addDownload(bookId);
            return { success: { book, card } };
        } else {
            return { fail: `Couldn't find book for id: '${ctx.query.id}'` };
        }
    } else {
        return { fail: 'Book id is not specified' };
    }
});

router.get('/uploads', authOpt(async ctx => {
    const account = ctx.account;
    if (!account) {
        return { fail: 'Not authorized' };
    }

    const bookIds = await uploads.all(account._id);
    const cards = await books.cards(bookIds);
    return { success: { cards, name: 'uploads' } };
}));

router.post('/uploads', authOpt(async ctx => {
    if (!ctx.account) {
        return { fail: 'Not authorized' };
    }
    const publicDomain = ctx.query.publicDomain ?? false;
    const book = ctx.request.files.book;
    if (book) {
        const bookId = await books.uploadEpub({
            filePath: book.path,
            publicDomain,
            accountId: ctx.account._id,
        });
        return bookId
            ? { success: bookId }
            : { fail: `Couldn't parse book` };
    }

    return { fail: 'File is not attached' };
}));

router.get('/popular', async ctx => {
    const bookIds = await downloads.popular();
    const cards = await books.cards(bookIds);

    return { success: cards };
});

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
