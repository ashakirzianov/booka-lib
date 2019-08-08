import { ParameterizedContext, Middleware } from 'koa';
import * as KoaRouter from 'koa-router';
import { PathContract, ApiContract } from './contractTypes';

export type ApiHandlerResult<T> = {
    fail: string,
    status?: number,
    success?: undefined,
} | {
    fail?: undefined,
    success: T,
};
export type ExtendedContext<Params> = ParameterizedContext & {
    params: Partial<Params>, // TODO: make partial ?
};
export type ApiHandler<C extends PathContract> =
    (ctx: ExtendedContext<C['params']>) => Promise<ApiHandlerResult<C['return']>>;
export type Router<C extends ApiContract> = {
    routes: KoaRouter['routes'],
    allowedMethods: KoaRouter['allowedMethods'],
    get<Path extends keyof C['get']>(path: Path, handler: ApiHandler<C['get'][Path]>): Router<C>,
    post<Path extends keyof C['post']>(path: Path, handler: ApiHandler<C['post'][Path]>): Router<C>,
};

export function createRouter<C extends ApiContract>(): Router<C> {
    const koaRouter = new KoaRouter();

    function getRouter() {
        return router;
    }

    const router: Router<C> = {
        routes: koaRouter.routes,
        allowedMethods: koaRouter.allowedMethods,
        get<Path extends keyof C['get']>(path: Path, handler: ApiHandler<C['get'][Path]>): Router<C> {
            koaRouter.get(path as string, buildMiddleware(handler));
            return getRouter();
        },
        post<Path extends keyof C['post']>(path: Path, handler: ApiHandler<C['post'][Path]>): Router<C> {
            koaRouter.post(path as string, buildMiddleware(handler));
            return getRouter();
        },
    };

    return router;
}

function buildMiddleware<R extends PathContract>(handler: ApiHandler<R>): Middleware<{}> {
    return async ctx => {
        const handlerResult = await handler(ctx as any);

        if (handlerResult.fail === undefined) {
            ctx.response.body = handlerResult.success;
        } else {
            ctx.response.status = handlerResult.status || 500;
            ctx.response.body = undefined;
        }
    };
}
