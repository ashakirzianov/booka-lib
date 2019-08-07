export function isDebug() {
    return process.env.NODE_ENV === 'development';
}

export async function debugAsync(f: () => Promise<void>) {
    if (isDebug()) {
        await f();
    }
}

export function debug(f: () => void) {
    if (isDebug()) {
        f();
    }
}

type ConfigValue<T> = {
    default?: T,
    debug?: T,
    production?: T,
};

export function configValue<T>(pv: { default: T } & Partial<ConfigValue<T>>): T;
export function configValue<T, U>(pv: { debug: T, production: U }): T | U;
export function configValue<T>(pv: ConfigValue<T>): T | undefined {
    if (isDebug()) {
        return pv.debug || pv.default;
    } else {
        return pv.production || pv.default;
    }
}

export function noOp() { return; }

function logDebug(msg: string) {
    // tslint:disable-next-line:no-console
    console.log(msg);
}
