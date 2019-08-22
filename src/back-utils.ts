// Router:

import { Middleware } from 'koa';
import * as KoaRouter from 'koa-router';
import {
    PathMethodContract, ApiContract, MethodNames,
    AllowedPaths, Contract, Defined,
} from 'booka-common';

export type ApiHandlerResult<T> = {
    fail: string,
    status?: number,
    success?: undefined,
} | {
    fail?: undefined,
    success: T,
};
export type RestrictedContext<C extends PathMethodContract, Ext = {}> = Ext & {
    params: Partial<C['params']>,
    query: Partial<C['query']>,
    request: {
        files: {
            [k in Defined<C['files']>]: File | undefined;
        },
        headers: {
            Authorization?: string,
        },
    },
};

export type ApiHandler<C extends PathMethodContract, Ext = {}> =
    (ctx: RestrictedContext<C, Ext>, next: () => Promise<any>) => Promise<ApiHandlerResult<C['return']>>;
export type DefinePathFn<C extends ApiContract, M extends MethodNames> =
    <Path extends AllowedPaths<C, M>>(path: Path, handler: ApiHandler<Contract<C, M, Path>>) => Router<C>;
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
            koaRouter[m](path as any, buildMiddleware(handler));
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

function buildMiddleware<R extends PathMethodContract>(handler: ApiHandler<R>): Middleware<{}> {
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

export type File = {
    size: number,
    path: string,
    name: string,
    type: string,
    lastModifiedDate?: Date,
    hash?: string,

    toJSON(): object,
};

// Mongoose:

import { Schema } from 'mongoose';

export type TypeFromSchema<T extends SchemaDefinition> =
    { id?: string } &
    { [P in Extract<keyof T, RequiredProperties<T>>]: ActualType<T[P]> } &
    { [P in Exclude<keyof T, RequiredProperties<T>>]?: ActualType<T[P]> };

type RequiredProperties<T> = Exclude<{
    [K in keyof T]: T[K] extends { required: boolean }
    ? K
    : never
}[keyof T], undefined>;

type SchemaDefinition = {
    [x: string]: SchemaField,
};

type SchemaField = {
    type: any,
    index?: boolean,
    required?: boolean,
};

type ActualType<T extends SchemaField> =

    T['type'] extends StringConstructor ? string :
    T['type'] extends typeof Schema.Types.String ? string :

    T['type'] extends NumberConstructor ? number :
    T['type'] extends Schema.Types.Number ? number :

    T['type'] extends DateConstructor ? Date :
    T['type'] extends typeof Schema.Types.Date ? Date :

    T['type'] extends ArrayBufferConstructor ? Buffer :
    T['type'] extends typeof Schema.Types.Buffer ? Buffer :

    T['type'] extends BooleanConstructor ? boolean :
    T['type'] extends typeof Schema.Types.Boolean ? boolean :

    T['type'] extends typeof Schema.Types.ObjectId ? string :

    T['type'] extends typeof Schema.Types.Decimal128 ? Schema.Types.Decimal128 :

    // TODO make item type specific
    T['type'] extends typeof Array ? any[] :

    // TODO make item type specific
    T['type'] extends typeof Map ? (T extends { of: SchemaField } ? Map<string, any> : never) :

    never;
