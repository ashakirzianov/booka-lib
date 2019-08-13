import { basename } from 'path';
import { readFile } from 'fs';
import { S3 } from 'aws-sdk';
import { BookObject } from './common/bookFormat';
import { config } from './config';
import { promisify } from 'util';

const service = new S3();

export async function uploadBookObject(bookId: string, book: BookObject) {
    const bookBody = JSON.stringify(book);
    const key = `${bookId}.json`;
    const result = await service.putObject({
        Bucket: config().bucket.json,
        Key: key,
        Body: bookBody,
    }).promise();

    return key;
}

export async function uploadOriginalFile(filePath: string) {
    const fileBody = await promisify(readFile)(filePath);
    const key = basename(filePath);
    const result = await service.putObject({
        Bucket: config().bucket.original,
        Key: key,
        Body: fileBody,
    }).promise();

    return key;
}

export async function downloadJson(assetId: string): Promise<string | undefined> {
    try {
        const result = await service.getObject({
            Bucket: config().bucket.json,
            Key: assetId,
        }).promise();
        return result.Body as string;
    } catch (e) {
        return undefined;
    }
}
