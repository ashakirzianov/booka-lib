import { TypeFromSchema, model } from './utils';

const schema = {
    bookId: {
        type: String,
        required: true,
    },
    count: {
        type: Number,
        required: true,
    },
} as const;

export type DbDownload = TypeFromSchema<typeof schema>;
const docs = model('Download', schema);

async function addDownload(bookId: string) {
    docs.update(
        { bookId },
        { $inc: { count: 1 } },
        { upsert: true, new: true },
    );
}

async function popular() {
    const results = docs
        .find()
        .sort({ count: +1 })
        .limit(50)
        .exec();
    return results;
}

export const uploads = {
    addDownload,
    popular,
};
