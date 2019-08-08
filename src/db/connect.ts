import * as Mongoose from 'mongoose';
import { readdir } from 'fs';

import { promisify } from 'util';
import { books } from './books';
import { info } from './info';
import { logger, logTimeAsync } from '../log';
import { parserVersion, loadEpubPath } from '../epub';

const epubLocation = 'public/epub/';

export async function connectDb() {
    Mongoose.set('useNewUrlParser', true);
    Mongoose.set('useFindAndModify', false);
    Mongoose.set('useCreateIndex', true);

    Mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booka');

    await logTimeAsync('seed', seed);
}

async function seed() {
    seedImpl(parserVersion);
}

async function seedImpl(pv: number) {
    const storedVersion = await info.parserVersion();
    if (pv !== storedVersion) {
        await books.removeAll();
    }

    const count = await books.count();
    if (count === 0) {
        const files = await promisify(readdir)(epubLocation);
        const promises = files
            // .slice(2, 4)
            .map(path => epubLocation + path)
            .map(parseAndInsert);
        await Promise.all(promises);
        info.setParserVersion(pv);
    }
}

export async function parseAndInsert(fullPath: string) {
    try {
        const book = await logTimeAsync(
            `Parse: ${fullPath}`,
            () => loadEpubPath(fullPath)
        );
        return await books.insertParsed(book);
    } catch (e) {
        logger().warn(`While parsing '${fullPath}' error: ${e}`);
        return undefined;
    }
}
