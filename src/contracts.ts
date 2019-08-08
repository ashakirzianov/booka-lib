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
        '/id/:id': Book,
        'all': BookCollection,
    },
    post: {
        'upload': string,
    },
};
