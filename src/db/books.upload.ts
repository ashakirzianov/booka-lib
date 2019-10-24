import * as sharp from 'sharp';
import { promisify } from 'util';
import { readFile } from 'fs';
import { parseEpub } from 'booka-parser';
import {
    extractBookText, buildFileHash, buildBookHash, Book, getCoverBase64,
    compoundDiagnostic, Diagnostic, success, failure, Result,
} from 'booka-common';
import { logger } from '../log';
import { uploadBody } from '../assets';
import { generateBookId, DbBook, docs } from './books.base';
import { uploads } from './uploads';

const bookaExt = '.booka';

export async function uploadEpub(filePath: string, accountId: string) {
    const bookId = await parseAndInsert(filePath);
    await uploads.addUpload(accountId, bookId);
    return bookId;
}

export async function parseAndInsert(filePath: string) {
    const processResult = await processFile(filePath);
    if (processResult.alreadyExist) {
        return processResult.bookId;
    }
    const { book, bookHash, fileHash } = processResult;

    const bookId = await generateBookId(book.meta.title, book.meta.author);

    const uploadResult = await uploadBookAsset({
        bookId, book,
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
            jsonAssetId: uploadResult.value.json,
            originalAssetId: uploadResult.value.original,
            bookId: bookId,
            bookHash,
            fileHash,
            tags: book.tags,
            textLength,
        };

        const inserted = await docs.insertMany(bookDocument);
        if (inserted) {
            logger().important('Inserted book for id: ' + bookId);
            return bookId;
        }
    }

    throw new Error(`Couldn't insert book for id: '${bookId}'`);
}

async function processFile(filePath: string) {
    const fileHash = await buildFileHash(filePath);
    const existingFile = await checkForFileDuplicates(fileHash);
    if (existingFile) {
        return {
            alreadyExist: true as const,
            bookId: existingFile.bookId,
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
            bookId: existingBook.bookId,
        };
    }

    return {
        alreadyExist: false as const,
        book, bookHash, fileHash,
    };
}

type UploadBookInput = {
    book: Book,
    bookId: string,
    originalFilePath: string,
};
type UploadBookOutput = {
    json: string,
    original?: string,
};
async function uploadBookAsset({ book, bookId, originalFilePath }: UploadBookInput): Promise<Result<UploadBookOutput>> {
    const diags: Diagnostic[] = [];
    const key = `${bookId}${bookaExt}`;
    const coverResult = await uploadCover(bookId, book);
    diags.push(coverResult.diagnostic);
    const json = JSON.stringify(book);
    const jsonResult = await uploadBody('booka-lib-json', key, json);
    diags.push(jsonResult.diagnostic);
    if (jsonResult.success) {
        const originalResult = await uploadOriginalFile(bookId, originalFilePath);
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

async function uploadOriginalFile(bookId: string, filePath: string) {
    const fileBody = await promisify(readFile)(filePath);
    const key = `${bookId}`;
    const result = await uploadBody('booka-lib-originals', key, fileBody);

    return result;
}
