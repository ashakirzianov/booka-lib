import { generateBookId, DbBook, docs } from './books.base';
import { extractBookText, buildFileHash, buildBookHash, Book, storeImages } from 'booka-common';
import { logger } from '../log';
import { parseEpub } from 'booka-parser';
import { assets } from '../assets';

export async function parseAndInsert(filePath: string) {
    const processResult = await processFile(filePath);
    if (processResult.alreadyExist) {
        return processResult.bookId;
    }
    const { book, bookHash, fileHash } = processResult;

    const bookId = await generateBookId(book.meta.title, book.meta.author);

    const uploadResult = await uploadBookAsset(bookId, filePath, book);
    if (uploadResult) {
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
            jsonAssetId: uploadResult.jsonAssetId,
            originalAssetId: uploadResult.originalAssetId,
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

async function uploadBookAsset(bookId: string, filePath: string, book: Book) {
    const resolvedBook = await uploadAndResolveBookImages(bookId, book);
    const jsonAssetId = await assets.uploadBookObject(bookId, book);
    if (jsonAssetId) {
        const originalAssetId = await assets.uploadOriginalFile(bookId, filePath);

        return {
            jsonAssetId, originalAssetId,
        };
    }

    return undefined;
}

async function uploadAndResolveBookImages(
    bookId: string,
    book: Book,
): Promise<Book> {
    const resolved = await storeImages(book, async (buffer, imageId) => {
        const imageBuffer = Buffer.from(buffer);
        const imageUrl = await assets.uploadBookImage(bookId, imageId, imageBuffer);

        return imageUrl;
    });
    return resolved;
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
