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
    get: {
        '/single': {
            query: { id: string },
            return: BookObject,
        },
        '/all': { return: BookCollection, },
    },
    post: {
        '/upload': {
            return: string,
            files: 'book',
        },
    },
};
