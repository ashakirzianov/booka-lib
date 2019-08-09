import { VolumeNode } from './bookFormat';

type BookInfo = {
    id: string,
    title: string,
    author?: string,
};

type BookCollection = {
    books: BookInfo[],
};

type Book = VolumeNode;

export type LibraryContract = {
    get: {
        '/single': {
            query: { id: string },
            return: Book,
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
