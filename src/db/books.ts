import {
    Book, VolumeNode, collectImageRefs, BookInfo,
} from 'booka-common';
import { transliterate, filterUndefined } from '../utils';
import { logger } from '../log';
import { parseEpubAtPath, Image } from 'booka-parser';
import { assets as s3assets } from '../assets';
import { assets as mongoAssets } from '../assets.mongo';
import { buildHash } from '../duplicates';
import { config } from '../config';
import { TypeFromSchema, model, paginate } from '../back-utils';

const assets = config().assets === 'mongo'
    ? mongoAssets
    : s3assets;

const schema = {
    author: {
        type: String,
        index: true,
    },
    title: {
        type: String,
        index: true,
        required: true,
    },
    cover: String,
    bookId: {
        type: String,
        index: true,
        required: true,
    },
    jsonAssetId: {
        type: String,
        required: true,
    },
    originalAssetId: String,
    hash: {
        type: String,
        required: true,
    },
    license: String,
} as const;

export type DbBook = TypeFromSchema<typeof schema>;
const docs = model('Book', schema);

export const books = {
    byBookId,
    parseAndInsert,
    all,
    count,
    removeAll,
    infos,
};

async function byBookId(id: string) {
    const book = await docs.findOne({ bookId: id }).exec();
    if (!book || !book.jsonAssetId) {
        return undefined;
    }

    const json = await assets.downloadJson(book.jsonAssetId);
    if (json) {
        const parsed = JSON.parse(json);
        const contract = parsed as Book;

        return contract;
    } else {
        return undefined;
    }
}

async function parseAndInsert(filePath: string) {
    const parsingResult = await parseEpubAtPath(filePath);
    if (!parsingResult.success) {
        throw new Error(`Couldn't parse book at path: '${filePath}'`);
    }

    const volume = parsingResult.volume;
    const duplicate = await checkForDuplicates(volume);
    if (duplicate.exist) {
        return duplicate.document.bookId;
    }

    const bookId = await generateBookId(volume.meta.title, volume.meta.author);

    const book = await buildBookObject(bookId, volume, parsingResult.resolveImage);
    const jsonAssetId = await assets.uploadBookObject(bookId, book);
    if (jsonAssetId) {
        const originalAssetId = await assets.uploadOriginalFile(bookId, filePath);
        const coverImageId = book.volume.meta.coverImageId;
        const coverUrl = coverImageId
            ? book.idDictionary.image[coverImageId.id]
            : undefined;
        const bookDocument: DbBook = {
            title: book.volume.meta.title,
            author: book.volume.meta.author,
            cover: coverUrl,
            jsonAssetId: jsonAssetId,
            originalAssetId: originalAssetId,
            bookId: bookId,
            hash: duplicate.hash,
        };

        const inserted = await docs.insertMany(bookDocument);
        if (inserted) {
            logger().important('Inserted book for id: ' + bookId);
            return bookId;
        }
    }

    throw new Error(`Couldn't insert book for id: '${bookId}'`);
}

async function all(page: number): Promise<BookInfo[]> {
    const bookMetas = await paginate(
        docs
            .find({}, ['title', 'author', 'bookId', 'cover']),
        page,
    ).exec();
    const allMetas = bookMetas.map(
        book => book.id
            ? {
                author: book.author,
                title: book.title,
                cover: book.cover,
                id: book.bookId,
                tags: [],
            }
            : undefined
    );

    return filterUndefined(allMetas);
}

async function infos(ids: string[]): Promise<BookInfo[]> {
    const result = await docs
        .find({ id: { $in: ids } })
        .exec();

    return result.map(r => ({
        id: r.bookId,
        tags: [],
        author: r.author,
        title: r.title,
        cover: r.cover,
    }));
}

async function buildBookObject(
    bookId: string,
    volume: VolumeNode,
    imageResolver: (id: string) => Promise<Image | undefined>,
): Promise<Book> {
    const imageRefs = collectImageRefs(volume);
    const imagesDic: { [k: string]: string } = {};
    for (const ref of imageRefs) {
        // TODO: report errors
        const imageId = ref.id;
        const image = await imageResolver(imageId);
        if (image) {
            const imageUrl = await assets.uploadBookImage(bookId, imageId, image.buffer);
            if (imageUrl) {
                imagesDic[imageId] = imageUrl;
            }
        }
    }
    return {
        volume: volume,
        idDictionary: {
            image: imagesDic,
        },
    };
}

async function checkForDuplicates(volume: VolumeNode) {
    const hash = await buildHash(volume);
    const existing = await docs.findOne({ hash }).exec();

    if (existing) {
        return {
            exist: true as const,
            document: existing,
            hash,
        };
    } else {
        return {
            exist: false as const,
            hash,
        };
    }
}

async function count() {
    return docs.countDocuments().exec();
}

async function removeAll() {
    await docs.deleteMany({});
}

async function isBookExists(bookId: string): Promise<boolean> {
    const book = await docs.findOne({ bookId });
    return book !== null;
}

async function generateBookId(title: string, author?: string): Promise<string> {
    for (const bookId of bookIdCandidate(title, author)) {
        if (!await isBookExists(bookId)) {
            return bookId;
        }
    }

    throw new Error('Could not generate book id');
}

function* bookIdCandidate(title: string, author?: string) {
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
