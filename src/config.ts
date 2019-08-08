export function config(): Config {
    return isDebug()
        ? debugConfig()
        : productionConfig();
}

function debugConfig(): Config {
    return {
        defaultPort: 3145,
        ssl: {
            keyPath: 'server.key',
            certPath: 'server.crt',
        },
    };
}

function productionConfig(): Config {
    return {
        defaultPort: 3145,
    };
}

function isDebug() {
    return process.env.NODE_ENV === 'development';
}

export type SslConfig = {
    keyPath: string,
    certPath: string,
};

export type Config = {
    defaultPort: number,
    ssl?: SslConfig,
};
