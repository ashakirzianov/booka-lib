import { Request, ParameterizedContext } from 'koa';
import * as KoaRouter from 'koa-router';
import { Result } from '../contracts';

export function createRouter() {
    const koaRouter = new KoaRouter();

    return koaRouter;
}

// Note: this is a bit cryptic way
// of getting actual koa-body file type
type File = (Request['files'] extends infer R | undefined
    ? R : undefined)[''];
type StringMap<T> = {
    [k: string]: T | undefined;
};
type ApiHandlerParam = {
    params: StringMap<string>,
    query: StringMap<string>,
    files: StringMap<File>,
};
type ApiHandlerResult<T> = {
    fail: string,
    success?: undefined,
} | {
    fail?: undefined,
    success: T,
};
type ApiHandler<R> = (param: ApiHandlerParam) => Promise<ApiHandlerResult<R>>;
export function jsonApi<R = {}>(handler: ApiHandler<R>): KoaRouter.IMiddleware<{}> {
    return async ctx => {
        const param = paramFromContext(ctx);
        const handlerResult = await handler(param);

        const apiResult: Result<R> = handlerResult.success
            ? { success: true, value: handlerResult.success }
            : { success: false, reason: handlerResult.fail };

        ctx.response.body = apiResult;
    };
}

function paramFromContext(ctx: ParameterizedContext): ApiHandlerParam {
    return {
        params: ctx.params,
        query: ctx.query,
        files: ctx.request.files || {},
    };
}
