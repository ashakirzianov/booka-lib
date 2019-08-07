export function config(): Config {
    return isDebug()
        ? debugConfig()
        : productionConfig();
}

function debugConfig(): Config {
    return {
        ssl: {
            keyPath: 'server.key',
            certPath: 'server.crt',
        },
    };
}

function productionConfig(): Config {
    return {};
}

function isDebug() {
    return process.env.NODE_ENV === 'development';
}

export type SslConfig = {
    keyPath: string,
    certPath: string,
};

export type Config = {
    ssl?: SslConfig,
};
