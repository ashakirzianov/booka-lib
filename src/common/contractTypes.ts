export type AuthContract = {
    auth: string,
};
export type PathMethodContract = {
    return: object | string | number | boolean,
    params?: object,
    query?: object,
    files?: string,
} & Partial<AuthContract>;
export type PathContract = {
    get?: PathMethodContract,
    post?: PathMethodContract,
};

export type ApiContract = {
    [k: string]: PathContract,
};
export type MethodNames = keyof PathContract;
export type AllowedPaths<C extends ApiContract, M extends MethodNames> = Exclude<{
    [k in keyof C]: undefined extends C[k][M] ? never : k;
}[keyof C], number | symbol>;
export type Contract<
    C extends ApiContract,
    M extends MethodNames,
    Path extends AllowedPaths<C, M>,
    > = Defined<C[Path][M]>;
export type Defined<T> = Exclude<T, undefined>;
