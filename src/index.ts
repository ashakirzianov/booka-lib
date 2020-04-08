import * as Koa from 'koa';
import * as cors from '@koa/cors';
import * as koaBody from 'koa-body';
import * as logger from 'koa-logger';
import { config as configEnv } from 'dotenv';
import * as https from 'https';
import * as http from 'http';
import { existsSync, readFileSync } from 'fs';
import { router } from './routes';
import { config, SslConfig } from './config';
import { logDebug } from './log';
import { connectDb } from './utils';

configEnv();
startup(new Koa());

async function startup(app: Koa) {
    await connectDb(process.env.LIB_MONGODB_URI || 'mongodb://localhost:27017/booka-lib');

    app.use(logger());
    app.use(cors({
        origin: '*',
    }));
    app.use(koaBody({
        multipart: true,
        formLimit: 50 * 1024 * 1024,
    }));

    app
        .use(router.routes())
        .use(router.allowedMethods())
        ;

    listen(app);
}

function listen(app: Koa) {
    const port = process.env.PORT || config().defaultPort;
    createServer(app.callback())
        .listen(port);
}

function createServer(requestListener: http.RequestListener) {
    const sslConfig = config().ssl;
    if (sslConfig) {
        const options = serverOptions(sslConfig);
        return https.createServer(options, requestListener);
    } else {
        return http.createServer(requestListener);
    }
}

function serverOptions(sslConfig: SslConfig): https.ServerOptions {
    if (existsSync(sslConfig.keyPath) && existsSync(sslConfig.certPath)) {
        return {
            key: readFileSync(sslConfig.keyPath),
            cert: readFileSync(sslConfig.certPath),
        };
    } else {
        logDebug(`You should add '${sslConfig.keyPath}' and '${sslConfig.certPath}' for server to work properly on localhost`);
    }

    return {};
}
