import { PathMethodContract, AuthContract, AccountInfo } from 'booka-common';
import Axios from 'axios';
import { ApiHandler } from './utils';
import { config } from './config';

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

async function fetchAccountInfo(authHeader: string) {
    const response = await Axios.get(`${config().backendBase}/me/info`, {
        responseType: 'json',
        headers: {
            Authorization: authHeader,
        },
    });

    if (response.data) {
        return response.data as AccountInfo;
    } else {
        return undefined;
    }
}
