import * as KoaRouter from 'koa-router';
import { bookRouter } from './book';

export const router = new KoaRouter();

router.use('/book', bookRouter.routes());
