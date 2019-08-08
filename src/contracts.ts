import { VolumeNode } from './bookFormat';

export type BookInfo = {
    id: string,
    title: string,
    author?: string,
};

export type BookCollection = {
    books: BookInfo[],
};

export type Book = VolumeNode;
