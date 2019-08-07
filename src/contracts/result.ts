export type Result<T> = {
    success: true,
    value: T,
} | {
    success: false,
    reason?: string,
};
