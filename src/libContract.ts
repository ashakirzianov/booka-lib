import { BookObject } from './bookFormat';

export type BookInfo = {
    id: string,
    title: string,
    author?: string,
};

export type BookCollection = {
    books: BookInfo[],
};

export type LibContract = {
    '/single': {
        get: {
            query: { id: string },
            return: BookObject,
        },
    },
    '/all': {
        get: { return: BookCollection },
    },
    '/upload': {
        post: {
            return: string,
            files: 'book',
        },
    },
};
