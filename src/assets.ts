import { basename } from 'path';
import { readFile } from 'fs';
import { S3 } from 'aws-sdk';
import { BookObject } from './common/bookFormat';
import { config } from './config';
import { promisify } from 'util';

const service = new S3();

export async function uploadBookObject(bookId: string, book: BookObject) {
    const bookBody = JSON.stringify(book);
    const result = await service.putObject({
        Bucket: config().bucket.json,
        Key: `${bookId}.json`,
        Body: bookBody,
    }).promise();

    // TODO: get actual file path
    const servicePath = undefined;

    return servicePath;
}

export async function uploadOriginalFile(filePath: string) {
    const fileBody = await promisify(readFile)(filePath);
    const result = await service.putObject({
        Bucket: config().bucket.original,
        Key: basename(filePath),
        Body: fileBody,
    }).promise();

    // TODO: get actual file path
    const servicePath = undefined;

    return servicePath;
}

export async function downloadJson(url: string): Promise<string | undefined> {
    return undefined;
}
