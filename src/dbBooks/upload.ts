import { slugify } from 'transliteration';
import { parseEpub } from 'booka-parser';
import {
    extractBookText, buildFileHash, buildBookHash,
} from 'booka-common';
import { logger } from '../log';
import { uploadJsonBucket, uploadEpubBucket } from '../assets';
import { DbBook, docs } from './docs';
import { uploads } from '../dbUploads';
import { uploadBookAsset } from './storage';

export async function uploadEpub({
    filePath, publicDomain, accountId,
}: {
    filePath: string,
    publicDomain: boolean,
    accountId: string,
}) {
    const bookId = await parseAndInsert(filePath, publicDomain);
    await uploads.addUpload(accountId, bookId);
    return bookId;
}

async function parseAndInsert(filePath: string, publicDomain: boolean) {
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
        const coverImage = book.meta.coverImage;
        const coverUrl = coverImage && coverImage.image === 'external'
            ? coverImage.url
            : undefined;
        const textLength = extractBookText(book).length;
        const bookDocument: DbBook = {
            title: book.meta.title,
            author: book.meta.author,
            license: book.meta.license,
            cover: coverUrl,
            jsonBucketId: uploadJsonBucket,
            jsonAssetId: uploadResult.value.json,
            originalBucketId: uploadEpubBucket,
            originalAssetId: uploadResult.value.original,
            bookAlias: bookAlias,
            bookHash,
            fileHash,
            tags: book.tags,
            textLength,
        };

        const inserted = await docs.insertMany(bookDocument);
        if (inserted) {
            logger().important('Inserted book with alias: ' + bookAlias);
            return {
                id: inserted._id,
                alias: bookAlias,
            };
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

async function isBookExists(bookId: string): Promise<boolean> {
    const book = await docs.findOne({ bookId });
    return book !== null;
}

async function generateBookAlias(title?: string, author?: string): Promise<string> {
    // TODO: better solution for missing title
    for (const bookId of bookAliasCandidate(title || 'no-title', author)) {
        if (!await isBookExists(bookId)) {
            return bookId;
        }
    }

    throw new Error('Could not generate book id');
}

function* bookAliasCandidate(title: string, author?: string) {
    let candidate = transliterate(title);
    yield candidate;
    if (author) {
        candidate = transliterate(candidate + '-' + author);
        yield candidate;
    }

    for (let i = 0; true; i++) {
        yield candidate + '-' + i.toString();
    }
}

function transliterate(str: string) {
    const result = slugify(str, { allowedChars: 'a-zA-Z0-9-_' });
    return result;
}
