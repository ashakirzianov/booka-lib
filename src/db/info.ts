import { Document, Schema, model } from 'mongoose';
import { TypeFromSchema } from './mongooseMapper';
import { logger } from '../log';

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
async function parserVersion(): Promise<number> {
    const value = await getValue(parserVersionKey) || '0';
    const version = parseInt(value, 10);

    return isNaN(version) ? 0 : version;
}

async function setParserVersion(version: number) {
    await setValue(parserVersionKey, version.toString());
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
