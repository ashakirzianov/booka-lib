import {
    LibraryCard, SearchResult, KnownTag,
} from 'booka-common';
import { TypeFromSchema, model, paginate, taggedObject } from 'booka-utils';
import { downloadBook } from './storage';
import { Bucket } from '../assets';

const schema = {
    author: {
        type: String,
        index: true,
    },
    title: {
        type: String,
        index: true,
    },
    cover: String,
    coverSmall: String,
    bookAlias: {
        type: String,
        index: true,
        required: true,
    },
    jsonBucketId: {
        type: String,
        required: true,
    },
    jsonAssetId: {
        type: String,
        required: true,
    },
    originalBucketId: String,
    originalAssetId: String,
    fileHash: {
        type: String,
        required: true,
    },
    bookHash: {
        type: String,
        required: true,
    },
    license: {
        type: String,
        required: true,
    },
    tags: {
        type: [taggedObject<KnownTag>()],
        required: true,
    },
    textLength: {
        type: Number,
        required: true,
    },
    private: Boolean,
} as const;

export type DbBook = TypeFromSchema<typeof schema>;
export const docs = model('Book', schema);
