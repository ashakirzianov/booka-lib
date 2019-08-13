import { Model, Document, Schema, model } from 'mongoose';
import { TypeFromSchema } from './common/mongooseUtils';
import { BookObject } from './common/bookFormat';

export async function uploadBookObject(bookId: string, book: BookObject) {
    const bookBody = JSON.stringify(book);
    const result = await JsonCollection.insertMany({
        json: bookBody,
    }) as any;

    const inserted = result[0];
    if (inserted) {
        return inserted._id;
    } else {
        return undefined;
    }
}

export async function uploadOriginalFile(filePath: string) {
    return undefined;
}

export async function downloadJson(url: string): Promise<string | undefined> {
    const doc = await JsonCollection.findById(url).exec();
    return doc
        ? doc.json
        : undefined;
}

const schema = {
    json: {
        type: String,
        required: true,
    },
};

type JsonDocument = TypeFromSchema<typeof schema> & Document;

const JsonSchema = new Schema(schema, { timestamps: true });
const JsonCollection: Model<JsonDocument> = model<JsonDocument>('Json', JsonSchema);
