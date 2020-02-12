import { byBookId, all, count, infos, search, card } from './books.base';
import { uploadEpub } from './books.upload';
export const books = {
    byBookId,
    uploadEpub,
    all,
    card,
    count,
    infos,
    search,
};
