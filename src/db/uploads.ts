import { TypeFromSchema, model } from 'booka-utils';

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
    const [result] = await docs.insertMany([{
        accountId, bookId, uploadDate: new Date(),
    }]);

    return result;
}

export const uploads = {
    addUpload,
};
