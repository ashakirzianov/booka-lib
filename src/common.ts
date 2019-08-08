// Routing:
import { ParameterizedContext, Middleware } from 'koa';
import * as KoaRouter from 'koa-router';

type StringKeysOf<T> = Exclude<keyof T, number | symbol>;
type ReturnValue = object | string | number | boolean;
type StringMap<Keys extends string> = {
    [k in Keys]: ReturnValue;
};
export type SingleContract<R extends ReturnValue = ReturnValue, P extends ReturnValue = ReturnValue> = {
    return: R,
    params?: P,
};
export type MethodContract<
    Keys extends string,
    R extends StringMap<Keys> = StringMap<Keys>,
    P extends StringMap<Keys> = StringMap<Keys>> = {
        [k in Keys]: SingleContract<R[k], P[k]>;
    };

export type ApiContract<
    Get extends MethodContract<StringKeysOf<Get>> = MethodContract<string>,
    Post extends MethodContract<StringKeysOf<Post>> = MethodContract<string>,
    > = {
        get: Get,
        post: Post,
    };

export type ApiFnResult<T> = {
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
export type ApiFn<C extends SingleContract> =
    (ctx: ExtendedContext<C['params']>) => Promise<ApiFnResult<C['return']>>;
export type Router<C extends ApiContract> = {
    routes: KoaRouter['routes'],
    allowedMethods: KoaRouter['allowedMethods'],
    get<Path extends keyof C['get']>(path: Path, handler: ApiFn<C['get'][Path]>): Router<C>,
    post<Path extends keyof C['post']>(path: Path, handler: ApiFn<C['post'][Path]>): Router<C>,
};

export function createRouter<C extends ApiContract>(): Router<C> {
    const koaRouter = new KoaRouter();

    function getRouter() {
        return router;
    }

    const router: Router<C> = {
        routes: koaRouter.routes,
        allowedMethods: koaRouter.allowedMethods,
        get<Path extends keyof C['get']>(path: Path, handler: ApiFn<C['get'][Path]>): Router<C> {
            koaRouter.get(path as string, jsonApi(handler));
            return getRouter();
        },
        post<Path extends keyof C['post']>(path: Path, handler: ApiFn<C['post'][Path]>): Router<C> {
            koaRouter.post(path as string, jsonApi(handler));
            return getRouter();
        },
    };

    return router;
}

function jsonApi<R extends SingleContract>(handler: ApiFn<R>): Middleware<{}> {
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
