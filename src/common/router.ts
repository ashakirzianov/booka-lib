import { ParameterizedContext, Middleware, Request } from 'koa';
import * as KoaRouter from 'koa-router';
import { PathContract, ApiContract, MethodNames } from './contractTypes';

export type ApiHandlerResult<T> = {
    fail: string,
    status?: number,
    success?: undefined,
} | {
    fail?: undefined,
    success: T,
};
export type ExtendedContext<C extends PathContract> = ParameterizedContext & {
    params: Partial<C['params']>,
    files?: {
        [k in Defined<C['files']>]: File | undefined;
    },
};
export type ApiHandler<C extends PathContract> =
    (ctx: ExtendedContext<C>) => Promise<ApiHandlerResult<C['return']>>;
export type MethodDefiner<C extends ApiContract, M extends MethodNames> =
    <Path extends keyof C[M]>(path: Path, handler: ApiHandler<C[M][Path]>) => Router<C>;
export type Router<C extends ApiContract> = {
    routes: KoaRouter['routes'],
    allowedMethods: KoaRouter['allowedMethods'],
} & {
        [m in MethodNames]: MethodDefiner<C, m>;
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

type Defined<T> = Exclude<T, undefined>;
// Note: this is a bit cryptic way
// of getting actual koa-body file type
type File = Defined<Request['files']>[string];
