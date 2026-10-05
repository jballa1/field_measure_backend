import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const client = postgres(process.env.DATABASE_URL!, {
    ssl: 'require',
    prepare: false, // Required for PgBouncer
    connection: {
        application_name: 'fieldmeasure_pro',
    },
});

export const db = drizzle(client, { schema });