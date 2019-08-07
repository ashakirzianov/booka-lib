import { createRouter } from './router';
import { bookRouter } from './book';

export const router = createRouter();

router.use('/book', bookRouter.routes());
