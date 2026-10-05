import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.js';
import fieldRoutes from './routes/fields.js';
import exportRoutes from './routes/export.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
});

await fastify.register(jwtPlugin);
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(fieldRoutes, { prefix: '/api/fields' });
await fastify.register(exportRoutes, { prefix: '/api/export' });

// For Vercel — export handler instead of listening
export default async function handler(req: any, res: any) {
    await fastify.ready();
    fastify.server.emit('request', req, res);
}

// For local development
if (process.env.NODE_ENV !== 'production') {
    try {
        await fastify.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}