import { Schema, model as modelMongoose, Document, Model, DocumentQuery, set, connect } from 'mongoose';

export async function connectDb(uri: string) {
    set('useNewUrlParser', true);
    set('useFindAndModify', false);
    set('useCreateIndex', true);
    set('useUnifiedTopology', true);

    return connect(uri);
}

export function paginate<T, D extends Document>(query: DocumentQuery<T, D>, page: number, pageSize: number = 100) {
    return query
        .skip(page * pageSize)
        .limit(pageSize);
}

export function model<S extends SchemaDefinition>(name: string, schema: S) {
    const schemaObject = new Schema(schema);
    return modelMongoose<DocumentType<S>>(name, schemaObject);
}

export function extractDataFields<T extends Document>(doc: T): DataFromModel<Model<T>> & HasId {
    const result = doc.toObject();
    delete result['__v'];
    return result;
}

export function taggedObject<T>(): TaggedObject<T> {
    return Object;
}

export type HasId = { _id: string };
export type DataFromModel<M extends Model<Document>> =
    M extends Model<infer D> ? Omit<D, keyof Document> : never;
export const ObjectId = Schema.Types.ObjectId;
export type ObjectId = Schema.Types.ObjectId;
type ObjectIdConstructor = typeof ObjectId;

type DocumentType<T extends SchemaDefinition> =
    & TypeFromSchema<T>
    & Document
    & { _id: ObjectId, }
    ;
export type TypeFromSchema<T extends SchemaDefinition> =
    & { [P in Extract<keyof T, RequiredProperties<T>>]: FieldType<T[P]>; }
    & { [P in Exclude<keyof T, RequiredProperties<T>>]?: FieldType<T[P]>; }
    ;

type RequiredProperties<T> = Exclude<{
    [K in keyof T]: T[K] extends { required: true }
    ? K
    : never
}[keyof T], undefined>;

type SchemaDefinition = {
    readonly [x: string]: SchemaField<any>,
};
type SchemaField<T extends SchemaType> = T | SchemaFieldComplex<T>;
type SchemaFieldComplex<T extends SchemaType> = {
    type: T,
    required?: boolean,
};

type TaggedObject<T> = ObjectConstructor & { _tag?: T };
type SchemaTypeSimple =
    | StringConstructor | NumberConstructor
    | BooleanConstructor | DateConstructor
    | ObjectConstructor | ObjectIdConstructor
    | TaggedObject<any>
    ;
type SchemaType =
    | SchemaTypeSimple
    | [SchemaTypeSimple] | readonly [SchemaTypeSimple]
    | SchemaTypeSimple[]
    ;

type GetTypeSimple<T> =
    T extends StringConstructor ? string :
    T extends NumberConstructor ? number :
    T extends BooleanConstructor ? boolean :
    T extends DateConstructor ? Date :
    T extends TaggedObject<infer U> ? U :
    T extends ObjectConstructor ? object :
    T extends ObjectIdConstructor ? string :
    never;
type GetType<T extends SchemaType> =
    T extends SchemaTypeSimple ? GetTypeSimple<T> :
    T extends [infer U] ? Array<GetTypeSimple<U>> :
    T extends readonly [infer RU] ? Array<GetTypeSimple<RU>> :
    T extends Array<infer AU> ? Array<GetTypeSimple<AU>> :
    never;
type FieldType<T extends SchemaField<any>> =
    T extends SchemaFieldComplex<infer U> ? GetType<U> :
    T extends SchemaType ? GetType<T> :
    never;
