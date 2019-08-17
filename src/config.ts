export function config(): Config {
    return isDebug()
        ? debugConfig()
        : productionConfig();
}

const commonConfig: Config = {
    assets: 's3',
    defaultPort: 3141,
    bucket: {
        json: 'booka-lib-json',
        original: 'booka-lib-original',
        images: 'booka-images',
    },
};

function debugConfig(): Config {
    return {
        ...commonConfig,
        assets: 'mongo',
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
    assets: 's3' | 'mongo',
    defaultPort: number,
    bucket: {
        json: string,
        original: string,
        images: string,
    },
    ssl?: SslConfig,
};
