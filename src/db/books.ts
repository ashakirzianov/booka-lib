import { byBookId, all, count, infos, search, meta } from './books.base';
import { uploadEpub } from './books.upload';
export const books = {
    byBookId,
    uploadEpub,
    all,
    meta,
    count,
    infos,
    search,
};
