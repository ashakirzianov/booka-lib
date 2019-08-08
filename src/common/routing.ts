import { ParameterizedContext, Middleware } from 'koa';

export type Result<T> = {
    success: true,
    value: T,
} | {
    success: false,
    reason?: string,
};

export type ApiHandlerResult<T> = {
    fail: string,
    success?: undefined,
} | {
    fail?: undefined,
    success: T,
};
type ApiHandler<R> = (ctx: ParameterizedContext) => Promise<ApiHandlerResult<R>>;
export function jsonApi<R = {}>(handler: ApiHandler<R>): Middleware<{}> {
    return async ctx => {
        const handlerResult = await handler(ctx);

        const apiResult: Result<R> = handlerResult.success
            ? { success: true, value: handlerResult.success }
            : { success: false, reason: handlerResult.fail };

        ctx.response.body = apiResult;
    };
}
