import { logger } from '../log';
import { model } from '../back-utils';

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

const InfoCollection = model('Info', schema);

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
