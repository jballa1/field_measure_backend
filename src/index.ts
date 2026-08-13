import 'dotenv/config';
import Fastify from 'fastify';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.js';
import fieldRoutes from './routes/fields.js';

const fastify = Fastify({ logger: true });

// Plugins
await fastify.register(jwtPlugin);

// Routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(fieldRoutes, { prefix: '/api/fields' });

// Start
try {
    await fastify.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}