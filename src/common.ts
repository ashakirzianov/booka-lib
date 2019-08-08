// Routing:
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
    status?: number,
    success?: undefined,
} | {
    fail?: undefined,
    success: T,
};
type ApiHandler<R> = (ctx: ParameterizedContext) => Promise<ApiHandlerResult<R>>;
export function jsonApi<R = {}>(handler: ApiHandler<R>): Middleware<{}> {
    return async ctx => {
        const handlerResult = await handler(ctx);

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
