import { Document, Schema, model } from 'mongoose';
import { logger } from '../log';
import { TypeFromSchema } from '../back-utils';

const schema = {
    key: {
        type: String,
        index: true,
        required: true,
    },
    value: {
        type: String,
        required: true,
    },
};

export type Info = TypeFromSchema<typeof schema>;
type InfoDocument = Info & Document;

const InfoSchema = new Schema(schema, { timestamps: true });
const InfoCollection = model<InfoDocument>('Info', InfoSchema);

export const info = {
    setParserVersion,
    parserVersion,
};

const parserVersionKey = 'pv';
async function parserVersion(): Promise<string> {
    const value = await getValue(parserVersionKey) || '0';

    return value;
}

async function setParserVersion(version: string) {
    await setValue(parserVersionKey, version);
    logger().important(`Update parser version to: ${version}`);
}

async function getValue(key: string): Promise<string | undefined> {
    const value = await InfoCollection.findOne({ key }).exec();
    return value === null
        ? undefined
        : value.value;
}

async function setValue(key: string, value: string) {
    await InfoCollection.updateOne({ key }, { value }, { upsert: true }).exec();
}
