import { readFile } from 'fs';
import { promisify } from 'util';
import * as sharp from 'sharp';
import {
    Book, Diagnostic, Result, success, compoundDiagnostic,
    getCoverBase64, failure,
} from 'booka-common';
import {
    downloadStringAsset, Bucket, uploadBody, uploadJsonBucket, uploadEpubBucket,
} from '../assets';

const bookaExt = '.booka';

const bookCache: {
    [k: string]: Book,
} = {};
export async function downloadBook(assetId: string, bucket: Bucket) {
    const cached = bookCache[assetId];
    if (cached) {
        return cached;
    }

    const json = await downloadStringAsset(bucket, assetId);
    if (json) {
        const parsed = JSON.parse(json);
        const contract = parsed as Book;
        bookCache[assetId] = contract;

        return contract;
    } else {
        return undefined;
    }
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
export async function uploadBookAsset({ book, bookAlias, originalFilePath }: UploadBookInput): Promise<Result<UploadBookOutput>> {
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
