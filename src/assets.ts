// tslint:disable: no-submodule-imports
import { S3 } from 'aws-sdk';
import { ListObjectsV2Output } from 'aws-sdk/clients/s3';
import { ContinuationToken } from 'aws-sdk/clients/kinesisvideomedia';
import { filterUndefined, Result, success, failure } from 'booka-common';

const service = new S3();

export const pgJsonBucket = 'booka-lib-json';
export const pgImagesBucket = 'booka-lib-images';
export const uploadsJsonBucket = 'booqs-uploads-json';
export const uploadsEpubBucket = 'booqs-uploads-epub';
export const uploadsImagesBucket = 'booqs-uploads-images';
export const buckets = [
    pgJsonBucket,
    pgImagesBucket,
    uploadsJsonBucket,
    uploadsEpubBucket,
    uploadsImagesBucket,
] as const;
export type Bucket = typeof buckets[number];

export async function* listObjects(bucket: Bucket) {
    for await (const batch of listObjectBatches(bucket)) {
        yield* batch;
    }
}

async function* listObjectBatches(bucket: Bucket) {
    let objects: ListObjectsV2Output;
    let token: ContinuationToken | undefined = undefined;
    do {
        objects = await service.listObjectsV2({
            Bucket: bucket,
            ContinuationToken: token,
        }).promise();
        token = objects.NextContinuationToken;
        yield objects.Contents
            ? objects.Contents
            : [];
    } while (objects.IsTruncated);
}

export async function deleteObject(bucket: Bucket, object: S3.Object) {
    if (object.Key) {
        const result = await service.deleteObject({
            Bucket: bucket,
            Key: object.Key,
        }).promise();
    }
}

export async function deleteObjects(bucket: Bucket, objects: S3.Object[]) {
    if (objects.length === 0) {
        return;
    }

    const keys = filterUndefined(objects.map(o => o.Key));
    const result = await service.deleteObjects({
        Bucket: bucket,
        Delete: {
            Objects: keys.map(k => ({
                Key: k,
            })),
        },
    }).promise();

    return keys;
}

export type UploadResult = {
    url: string,
    key: string,
};
export async function uploadBody(bucket: Bucket, key: string, body: S3.Body, metadata?: S3.Metadata): Promise<Result<UploadResult>> {
    try {
        const result = await service.putObject({
            Bucket: bucket,
            Key: key,
            Body: body,
            Metadata: metadata,
        }).promise();

        if (result.$response.data) {
            return success({
                url: buildUrl(bucket, key),
                key: key,
            });
        } else {
            return failure({
                diag: 'failed to upload',
                err: result.$response.error,
            });
        }
    } catch (e) {
        return failure({
            diag: 'exception on upload',
            err: e,
        });
    }
}

export async function downloadStringAsset(bucket: Bucket, assetId: string): Promise<string | undefined> {
    try {
        const result = await service.getObject({
            Bucket: bucket,
            Key: assetId,
        }).promise();
        return result.Body as string;
    } catch (e) {
        return undefined;
    }
}

function buildUrl(bucket: string, key: string): string {
    return `https://${bucket}.s3.amazonaws.com/${key}`;
}
