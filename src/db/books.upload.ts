import * as sharp from 'sharp';
import { promisify } from 'util';
import { readFile } from 'fs';
import { slugify } from 'transliteration';
import { parseEpub } from 'booka-parser';
import {
    extractBookText, buildFileHash, buildBookHash, Book, getCoverBase64,
    compoundDiagnostic, Diagnostic, success, failure, Result,
} from 'booka-common';
import { logger } from '../log';
import { uploadBody, uploadJsonBucket, uploadEpubBucket } from '../assets';
import { DbBook, docs } from './books.base';
import { uploads } from './uploads';

const bookaExt = '.booka';

export async function uploadEpub(filePath: string, accountId: string) {
    const bookId = await parseAndInsert(filePath);
    await uploads.addUpload(accountId, bookId);
    return bookId;
}

async function parseAndInsert(filePath: string) {
    const processResult = await processFile(filePath);
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

async function processFile(filePath: string) {
    const fileHash = await buildFileHash(filePath);
    const existingFile = await checkForFileDuplicates(fileHash);
    if (existingFile) {
        return {
            alreadyExist: true as const,
            bookId: existingFile._id,
        };
    }

    const parsingResult = await parseEpub({ filePath });
    if (!parsingResult.success) {
        throw new Error(`Couldn't parse book at path: '${filePath}'`);
    }

    const { book } = parsingResult.value;
    const bookHash = buildBookHash(book);
    const existingBook = await checkForBookDuplicates(bookHash);
    if (existingBook) {
        return {
            alreadyExist: true as const,
            bookId: existingBook._id,
        };
    }

    return {
        alreadyExist: false as const,
        book, bookHash, fileHash,
    };
}

type UploadBookInput = {
    book: Book,
    bookAlias: string,
    originalFilePath: string,
};
type UploadBookOutput = {
    json: string,
    original?: string,
};
async function uploadBookAsset({ book, bookAlias, originalFilePath }: UploadBookInput): Promise<Result<UploadBookOutput>> {
    const diags: Diagnostic[] = [];
    const key = `${bookAlias}${bookaExt}`;
    const coverResult = await uploadCover(bookAlias, book);
    diags.push(coverResult.diagnostic);
    const json = JSON.stringify(book);
    const jsonResult = await uploadBody(uploadJsonBucket, key, json);
    diags.push(jsonResult.diagnostic);
    if (jsonResult.success) {
        const originalResult = await uploadOriginalEpub(bookAlias, originalFilePath);
        diags.push(originalResult.diagnostic);
        if (originalResult.success) {
            return success(
                { json: jsonResult.value.key, original: jsonResult.value.key },
                compoundDiagnostic(diags),
            );
        } else {
            return success(
                { json: jsonResult.value.key },
                compoundDiagnostic(diags),
            );
        }
    } else {
        return failure(compoundDiagnostic(diags));
    }
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

async function uploadCover(bookId: string, book: Book) {
    const base64 = getCoverBase64(book);
    if (base64 === undefined) {
        return {};
    }
    const cover = Buffer.from(base64, 'base64');
    const diags: Diagnostic[] = [];
    const largeCoverKey = `@cover@large@${bookId}`;
    const largeResult = await uploadBody('booka-lib-images', largeCoverKey, cover);
    if (!largeResult.success) {
        diags.push({
            diag: 'failed to upload large cover',
            bookId,
            diagnostic: largeResult.diagnostic,
        });
    }
    const smallCoverKey = `@cover@small@${bookId}`;
    const smallCover = await resizeBookCover(cover);
    const smallResult = await uploadBody('booka-lib-images', smallCoverKey, smallCover);
    if (!smallResult.success) {
        diags.push({
            diag: 'failed to upload small cover',
            bookId,
            diagnostic: largeResult.diagnostic,
        });
    }

    return {
        smallCoverUrl: smallResult.success
            ? smallResult.value.url
            : undefined,
        largeCoverUrl: largeResult.success
            ? largeResult.value.url
            : undefined,
        diagnostic: compoundDiagnostic(diags),
    };
}

async function resizeBookCover(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .resize(null, 180)
        .toBuffer();
}

async function uploadOriginalEpub(bookId: string, filePath: string) {
    const fileBody = await promisify(readFile)(filePath);
    const key = `${bookId}`;
    const result = await uploadBody(uploadEpubBucket, key, fileBody);

    return result;
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
