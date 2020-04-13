import {
    PathMethodContract, AuthContract, AccountInfo, BackContract,
} from 'booka-common';
import { ApiHandler } from './utils';
import { config } from './config';
import { createFetcher } from './fetcher';

export function authOpt<C extends PathMethodContract & Partial<AuthContract>>(
    handler: ApiHandler<C, { account?: AccountInfo }>,
): ApiHandler<C, { account?: AccountInfo }> {
    return async (ctx, next) => {
        const authHeader = ctx.request.headers.authorization;
        const accountInfo = authHeader
            ? await fetchAccountInfo(authHeader)
            : undefined;
        ctx.account = accountInfo;
        return handler(ctx, next);
    };
}

const backFetcher = createFetcher<BackContract>(config().backendBase);
async function fetchAccountInfo(authHeader: string) {
    const token = authHeader.substr('Bearer '.length);
    const response = await backFetcher.get('/account', {
        auth: token,
    });

    if (response.success) {
        return response.value;
    } else {
        return undefined;
    }
}
