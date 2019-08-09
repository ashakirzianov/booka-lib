export type StringKeysOf<T> = Exclude<keyof T, number | symbol>;
type ReturnType = object | string | number | boolean;
type ParamsType = object;
type FilesType = string;
type StringMap<Keys extends string, R = ReturnType> = {
    [k in Keys]: R;
};
export type PathContract<
    R extends ReturnType = ReturnType,
    P extends ParamsType = ParamsType,
    Q extends ParamsType = ParamsType,
    F extends FilesType = FilesType,
    > = {
        return: R,
        params?: P,
        query?: Q,
        files?: F,
    };
export type MethodContract<
    Keys extends string = string,
    R extends StringMap<Keys> = StringMap<Keys>,
    P extends StringMap<Keys, ParamsType> = StringMap<Keys, ParamsType>,
    > = {
        [k in Keys]: PathContract<R[k], P[k]>;
    };

export type ApiContract<
    Get extends MethodContract<StringKeysOf<Get>> = MethodContract,
    Post extends MethodContract<StringKeysOf<Post>> = MethodContract,
    > = {
        get: Get,
        post: Post,
    };
export type MethodNames = keyof ApiContract;
