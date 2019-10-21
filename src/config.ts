export function config(): Config {
    return isDebug()
        ? debugConfig()
        : productionConfig();
}

const commonConfig: Config = {
    defaultPort: 3141,
    bucket: {
        json: 'booka-lib-json',
        original: 'booka-lib-originals',
        images: 'booka-lib-images',
    },
};

function debugConfig(): Config {
    return {
        ...commonConfig,
        // ssl: {
        //     keyPath: 'server.key',
        //     certPath: 'server.crt',
        // },
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
    defaultPort: number,
    bucket: {
        json: string,
        original: string,
        images: string,
    },
    ssl?: SslConfig,
};
