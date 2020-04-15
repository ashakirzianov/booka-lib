import { books } from './dbBooks';
import {
    LibContract, fragmentForPath, previewForPath,
    firstPath, pathFromString, defaultFragmentLength, nodePath, tocForBook, filterUndefined, positionForPath, bookLength, pathToString,
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

router.get('/path-data', async ctx => {
    const bookId = ctx.query.id;
    const node = ctx.query.node;
    if (bookId && node !== undefined) {
        const book = await books.byBookId(bookId);
        if (book) {
            const path = nodePath(node);
            const preview = previewForPath(book, path);
            if (!preview) {
                return { fail: `Couldn't resolve path: ${pathToString(path)}` };
            }
            const position = positionForPath(book, path);
            const of = bookLength(book);
            return { success: { preview, position, of } };
        } else {
            return { fail: `Couldn't find book for id: ${bookId}` };
        }
    } else {
        return { fail: 'Book id or node are not specified' };
    }
});

router.get('/toc', async ctx => {
    const bookId = ctx.query.id;
    if (bookId) {
        const book = await books.byBookId(bookId);
        if (book) {
            const toc = tocForBook(book);
            return { success: toc };
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
    const cards = filterUndefined(await books.cards(bookIds));
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
            ? { success: { bookId } }
            : { fail: `Couldn't parse book` };
    }

    return { fail: 'File is not attached' };
}));

router.get('/popular', async ctx => {
    const popular = await downloads.popular();
    const bookIds = popular.map(p => p.bookId);
    const cards = filterUndefined(await books.cards(bookIds));

    return { success: cards };
});

router.get('/cards', async ctx => {
    const bookIds = Array.isArray(ctx.query.ids) ? ctx.query.ids
        : typeof ctx.query.ids === 'string' ? [ctx.query.ids]
            : undefined;
    if (!bookIds) {
        return { fail: 'Book ids are not specified' };
    }
    const cards = await books.cards(bookIds);
    return cards
        ? { success: cards }
        : { fail: `Could not find card for id: ${bookIds}` };
});
