import { byBookId, count, search, card } from './books.base';
import { uploadEpub } from './books.upload';
export const books = {
    byBookId,
    uploadEpub,
    card,
    count,
    search,
};
