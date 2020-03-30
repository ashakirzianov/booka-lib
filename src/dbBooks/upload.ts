import { uploads } from '../dbUploads';
import { parseAndInsert } from './parse';

export async function uploadEpub({
    filePath, publicDomain, accountId,
}: {
    filePath: string,
    publicDomain: boolean,
    accountId: string,
}) {
    const bookId = await parseAndInsert(filePath, publicDomain);
    await uploads.addUpload(accountId, bookId);
    return bookId;
}
