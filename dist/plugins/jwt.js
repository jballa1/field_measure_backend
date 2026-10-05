import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
export default fp(async (fastify) => {
    await fastify.register(fastifyJwt, {
        secret: process.env.JWT_SECRET,
    });
    fastify.decorate('authenticate', async function (request, reply) {
        try {
            await request.jwtVerify();
        }
        catch (err) {
            reply.send(err);
        }
    });
});
