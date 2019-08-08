import { path2book } from './path2book';
import { VolumeNode } from '../bookFormat';
import { logger } from '../log';
import { preprocessBook } from '../preprocessBook';

export const parserVersion = 4;

export async function loadEpubPath(path: string): Promise<VolumeNode> {
    const book = await path2book(path);
    book.diagnostics.log(logger());
    const preprocessed = preprocessBook(book.value);

    return preprocessed;
}
