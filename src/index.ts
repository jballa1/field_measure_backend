import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.js';
import fieldRoutes from './routes/fields.js';
import exportRoutes from './routes/export.js';

const fastify = Fastify({ logger: true });

// CORS
await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
});

// Plugins
await fastify.register(jwtPlugin);

// Routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(fieldRoutes, { prefix: '/api/fields' });
await fastify.register(exportRoutes, { prefix: '/api/export' });

// Start
try {
    await fastify.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}