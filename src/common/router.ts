import { Middleware, Request } from 'koa';
import * as KoaRouter from 'koa-router';
import {
    PathContract, ApiContract, MethodNames, StringKeysOf,
} from './contractTypes';

export type ApiHandlerResult<T> = {
    fail: string,
    status?: number,
    success?: undefined,
} | {
    fail?: undefined,
    success: T,
};
export type RestrictedContext<C extends PathContract, Ext = {}> = Ext & {
    params: Partial<C['params']>,
    query: Partial<C['query']>,
    request: {
        files: {
            [k in Defined<C['files']>]: File | undefined;
        },
    },
};
export type ApiHandler<C extends PathContract, Ext = {}> =
    (ctx: RestrictedContext<C, Ext>, next: () => Promise<any>) => Promise<ApiHandlerResult<C['return']>>;
export type DefinePathFn<C extends ApiContract, M extends MethodNames> =
    <Path extends StringKeysOf<C[M]>>(path: Path, handler: ApiHandler<C[M][Path]>) => Router<C>;
export type Router<C extends ApiContract> = {
    routes: KoaRouter['routes'],
    allowedMethods: KoaRouter['allowedMethods'],
} & {
        [m in MethodNames]: DefinePathFn<C, m>;
    };

export function createRouter<C extends ApiContract>(): Router<C> {
    const koaRouter = new KoaRouter();

    function getRouter() {
        return router;
    }

    function buildDefinePathFn<M extends MethodNames>(m: M): DefinePathFn<C, M> {
        return (path, handler) => {
            koaRouter[m](path, buildMiddleware(handler));
            return getRouter();
        };
    }

    const router: Router<C> = {
        routes: koaRouter.routes.bind(koaRouter),
        allowedMethods: koaRouter.allowedMethods.bind(koaRouter),
        get: buildDefinePathFn('get'),
        post: buildDefinePathFn('post'),
    };

    return router;
}

function buildMiddleware<R extends PathContract>(handler: ApiHandler<R>): Middleware<{}> {
    return async (ctx, next) => {
        const handlerResult = await handler(ctx as any, next);

        if (handlerResult.fail === undefined) {
            ctx.response.body = handlerResult.success;
        } else {
            ctx.response.status = handlerResult.status || 500;
            ctx.response.body = handlerResult.fail;
        }
    };
}

type Defined<T> = Exclude<T, undefined>;
// Note: this is a bit cryptic way
// of getting actual koa-body file type
type File = Defined<Request['files']>[string];
