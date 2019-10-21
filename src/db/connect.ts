import * as Mongoose from 'mongoose';

export async function connectDb() {
    Mongoose.set('useNewUrlParser', true);
    Mongoose.set('useFindAndModify', false);
    Mongoose.set('useCreateIndex', true);

    Mongoose.connect(process.env.LIB_MONGODB_URI || 'mongodb://localhost:27017/booka-lib');
}
