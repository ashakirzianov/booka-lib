import { byBookId, all, count, infos } from './books.base';
import { uploadEpub } from './books.upload';
export const books = {
    byBookId,
    uploadEpub,
    all,
    count,
    infos,
};
