type StringKeysOf<T> = Exclude<keyof T, number | symbol>;
type ReturnType = object | string | number | boolean;
type ParamsType = object;
type StringMap<Keys extends string, R = ReturnType> = {
    [k in Keys]: R;
};
export type PathContract<
    R extends ReturnType = ReturnType,
    P extends object = object,
    > = {
        return: R,
        params?: P,
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
