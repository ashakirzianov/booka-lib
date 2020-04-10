import { parseEpub } from 'booka-parser';
import {
    extractBookText, buildFileHash, buildBookHash,
} from 'booka-common';
import { logger } from '../log';
import { uploadsJsonBucket, uploadsEpubBucket } from '../assets';
import { DbBook, docs } from './docs';
import { uploadBookAsset } from './storage';
import { generateBookAlias } from './alias';

export async function parseAndInsert(filePath: string, publicDomain: boolean): Promise<string> {
    const processResult = await processFile(filePath, publicDomain);
    if (processResult.alreadyExist) {
        return processResult.bookId;
    }
    const { book, bookHash, fileHash } = processResult;

    const bookAlias = await generateBookAlias(book.meta.title, book.meta.author);

    const uploadResult = await uploadBookAsset({
        bookAlias, book,
        originalFilePath: filePath,
    });
    if (uploadResult.success) {
        const textLength = extractBookText(book).length;
        const bookDocument: DbBook = {
            title: book.meta.title,
            author: book.meta.author,
            license: book.meta.license,
            jsonBucketId: uploadsJsonBucket,
            jsonAssetId: uploadResult.value.json,
            originalBucketId: uploadsEpubBucket,
            originalAssetId: uploadResult.value.original,
            cover: uploadResult.value.largeCover,
            coverSmall: uploadResult.value.smallCover,
            bookAlias: bookAlias,
            bookHash,
            fileHash,
            tags: book.tags,
            textLength,
            private: true,
            source: 'upload',
        };

        const [inserted] = await docs.insertMany([bookDocument]);
        if (inserted) {
            logger().important('Inserted book with alias: ' + bookAlias);
            return inserted._id;
        }
    }

    throw new Error(`Couldn't insert book: '${bookAlias}'`);
}

async function processFile(filePath: string, publicDomain: boolean) {
    const fileHash = await buildFileHash(filePath);
    const existingFile = await checkForFileDuplicates(fileHash);
    if (existingFile) {
        if (existingFile.license === 'not-marked-public-domain') {
            existingFile.license = 'marked-as-public-domain';
            await existingFile.save();
        }
        return {
            alreadyExist: true as const,
            bookId: existingFile._id,
        };
    }

    const parsingResult = await parseEpub({ filePath });
    if (!parsingResult.success) {
        throw new Error(`Couldn't parse book at path: '${filePath}'`);
    }

    let { book } = parsingResult.value;
    const bookHash = buildBookHash(book);
    const existingBook = await checkForBookDuplicates(bookHash);
    if (existingBook) {
        if (existingBook.license === 'not-marked-public-domain') {
            existingBook.license = 'marked-as-public-domain';
            await existingBook.save();
        }
        return {
            alreadyExist: true as const,
            bookId: existingBook._id,
        };
    }

    if (book.meta.license === 'unknown') {
        book = {
            ...book,
            meta: {
                ...book.meta,
                license: publicDomain
                    ? 'marked-public-domain'
                    : 'not-marked-public-domain',
            },
        };
    }

    return {
        alreadyExist: false as const,
        book, bookHash, fileHash,
    };
}

async function checkForFileDuplicates(fileHash: string) {
    const matchFileHash = await docs.findOne({ fileHash }).exec();
    return matchFileHash
        ? matchFileHash
        : undefined;
}

async function checkForBookDuplicates(bookHash: string) {
    const matchBookHash = await docs.findOne({ bookHash }).exec();
    return matchBookHash
        ? matchBookHash
        : undefined;
}
