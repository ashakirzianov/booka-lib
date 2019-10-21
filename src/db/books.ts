import { byBookId, all, count, infos } from './books.base';
import { parseAndInsert } from './books.upload';
export const books = {
    byBookId,
    parseAndInsert,
    all,
    count,
    infos,
};
