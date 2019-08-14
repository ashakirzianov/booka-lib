import * as Mongoose from 'mongoose';
import { parserVersion } from 'booka-parser';
import { readdir } from 'fs';

import { promisify } from 'util';
import { books } from './books';
import { info } from './info';
import { logTimeAsync } from '../log';
import { removeAllAssets } from '../assets.mongo';

const epubLocation = 'public/epub/';

export async function connectDb() {
    Mongoose.set('useNewUrlParser', true);
    Mongoose.set('useFindAndModify', false);
    Mongoose.set('useCreateIndex', true);

    Mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booka-lib');

    await logTimeAsync('seed', seed);
}

async function seed() {
    seedImpl(parserVersion);
}

async function seedImpl(pv: string) {
    const storedVersion = await info.parserVersion();
    const needCleanup = pv !== storedVersion;
    if (pv !== storedVersion) {
        await cleanup();
    }

    const count = await books.count();
    if (count === 0) {
        const files = await promisify(readdir)(epubLocation);
        const promises = files
            // .slice(2, 4)
            .map(path => epubLocation + path)
            .map(books.parseAndInsert);
        await Promise.all(promises);
    }

    if (needCleanup) {
        await info.setParserVersion(pv);
    }
}

async function cleanup() {
    await books.removeAll();
    await removeAllAssets();
}
