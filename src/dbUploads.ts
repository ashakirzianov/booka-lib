import { TypeFromSchema, model } from './utils';

const schema = {
    accountId: {
        type: String,
        required: true,
    },
    bookId: {
        type: String,
        required: true,
    },
    uploadDate: {
        type: Date,
        required: true,
    },
} as const;

export type DbUpload = TypeFromSchema<typeof schema>;
const docs = model('Upload', schema);

async function addUpload(accountId: string, bookId: string) {
    const result = await docs.findOneAndUpdate(
        { accountId, bookId },
        { accountId, bookId, uploadDate: new Date(Date.now()) },
        { upsert: true, new: true },
    );

    return result;
}

async function all(accountId: string) {
    const results = await docs.find({ accountId }).exec();
    return results.map(r => r.bookId);
}

export const uploads = {
    addUpload,
    all,
};
