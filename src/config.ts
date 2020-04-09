export function config(): Config {
    return isDebug()
        ? debugConfig()
        : productionConfig();
}

const commonConfig: Config = {
    backendBase: 'https://reader-back.herokuapp.com',
    defaultPort: 3141,
    bucket: {
        json: 'booka-lib-json',
        original: 'booka-lib-originals',
        images: 'booka-lib-images',
    },
};

const useLocalServices = process.env.LOCAL === 'env';
function debugConfig(): Config {
    return {
        ...commonConfig,
        backendBase: useLocalServices
            ? 'https://localhost:3042'
            : commonConfig.backendBase,
        ssl: {
            keyPath: 'server.key',
            certPath: 'server.crt',
        },
    };
}

function productionConfig(): Config {
    return {
        ...commonConfig,
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
    backendBase: string,
    defaultPort: number,
    bucket: {
        json: string,
        original: string,
        images: string,
    },
    ssl?: SslConfig,
};
