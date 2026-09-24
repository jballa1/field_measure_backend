import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export default async function authRoutes(fastify: FastifyInstance) {

    // POST /api/auth/register
    fastify.post('/register', async (request, reply) => {
        const { firstName, lastName, username, password } =
            request.body as {
                firstName: string;
                lastName: string;
                username: string;
                password: string;
            };

        if (!firstName?.trim())
            return reply.status(400).send({ error: 'First name is required.' });
        if (!lastName?.trim())
            return reply.status(400).send({ error: 'Last name is required.' });
        if (!username?.trim())
            return reply.status(400).send({ error: 'Username is required.' });
        if (!/^[a-z0-9_]{3,20}$/.test(username.toLowerCase()))
            return reply.status(400).send({
                error: 'Username must be 3-20 characters — letters, numbers, underscore only.',
            });
        if (!password || password.length < 6)
            return reply.status(400).send({
                error: 'Password must be at least 6 characters.',
            });

        const [existing] = await db
            .select()
            .from(users)
            .where(eq(users.username, username.toLowerCase()))
            .limit(1);

        if (existing)
            return reply.status(409).send({ error: 'Username already taken. Choose another.' });

        const passwordHash = await bcrypt.hash(password, 10);

        const [user] = await db
            .insert(users)
            .values({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                username: username.toLowerCase(),
                passwordHash,
            })
            .returning();

        const token = fastify.jwt.sign(
            { id: user.id, firstName: user.firstName, lastName: user.lastName, username: user.username, plan: user.plan },
            { expiresIn: '30d' }
        );

        return reply.send({
            token,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            plan: user.plan,
        });
    });

    // POST /api/auth/login
    fastify.post('/login', async (request, reply) => {
        const { username, password } = request.body as {
            username: string;
            password: string;
        };

        if (!username?.trim())
            return reply.status(400).send({ error: 'Username is required.' });
        if (!password)
            return reply.status(400).send({ error: 'Password is required.' });

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username.toLowerCase()))
            .limit(1);

        if (!user || !(await bcrypt.compare(password, user.passwordHash)))
            return reply.status(401).send({ error: 'Invalid username or password.' });

        const token = fastify.jwt.sign(
            { id: user.id, firstName: user.firstName, lastName: user.lastName, username: user.username, plan: user.plan },
            { expiresIn: '30d' }
        );

        return reply.send({
            token,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            plan: user.plan,
        });
    });

    // GET /api/auth/me
    fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.user as any;
        const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        if (!user) return reply.status(404).send({ error: 'User not found.' });
        return reply.send({
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            plan: user.plan,
        });
    });

    // PATCH /api/auth/update-profile
    fastify.patch('/update-profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.user as any;
        const { firstName, lastName } = request.body as { firstName: string; lastName: string };
        if (!firstName?.trim()) return reply.status(400).send({ error: 'First name is required.' });
        const [user] = await db
            .update(users)
            .set({ firstName: firstName.trim(), lastName: lastName?.trim() || '' })
            .where(eq(users.id, id))
            .returning();
        return reply.send({ firstName: user.firstName, lastName: user.lastName });
    });

    // PATCH /api/auth/change-password
    fastify.patch('/change-password', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.user as any;
        const { currentPassword, newPassword } = request.body as {
            currentPassword: string;
            newPassword: string;
        };
        const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash)))
            return reply.status(400).send({ error: 'Current password is incorrect.' });
        if (!newPassword || newPassword.length < 6)
            return reply.status(400).send({ error: 'New password must be at least 6 characters.' });
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await db.update(users).set({ passwordHash }).where(eq(users.id, id));
        return reply.send({ success: true });
    });

    // DELETE /api/auth/delete-account
    fastify.delete('/delete-account', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.user as any;
        await db.delete(users).where(eq(users.id, id));
        return reply.send({ success: true });
    });

    // POST /api/auth/verify-identity — check username + name match (no password change)
    fastify.post('/verify-identity', async (request, reply) => {
        const { username, firstName, lastName } = request.body as {
            username: string;
            firstName: string;
            lastName: string;
        };

        if (!username?.trim())
            return reply.status(400).send({ error: 'Username is required.' });
        if (!firstName?.trim())
            return reply.status(400).send({ error: 'First name is required.' });

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username.toLowerCase()))
            .limit(1);

        if (!user)
            return reply.status(404).send({ error: 'No account found with this username.' });

        if (user.firstName.toLowerCase() !== firstName.trim().toLowerCase())
            return reply.status(400).send({ error: 'Details do not match our records.' });

        if (lastName?.trim() && user.lastName.toLowerCase() !== lastName.trim().toLowerCase())
            return reply.status(400).send({ error: 'Details do not match our records.' });

        return reply.send({ success: true });
    });

    // POST /api/auth/forgot-password — reset password after identity verified
    fastify.post('/forgot-password', async (request, reply) => {
        const { username, firstName, lastName, newPassword } = request.body as {
            username: string;
            firstName: string;
            lastName: string;
            newPassword: string;
        };

        if (!username?.trim())
            return reply.status(400).send({ error: 'Username is required.' });
        if (!firstName?.trim())
            return reply.status(400).send({ error: 'First name is required.' });
        if (!newPassword || newPassword.length < 6)
            return reply.status(400).send({ error: 'Password must be at least 6 characters.' });

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username.toLowerCase()))
            .limit(1);

        if (!user)
            return reply.status(404).send({ error: 'No account found.' });

        if (user.firstName.toLowerCase() !== firstName.trim().toLowerCase())
            return reply.status(400).send({ error: 'Details do not match our records.' });

        if (lastName?.trim() && user.lastName.toLowerCase() !== lastName.trim().toLowerCase())
            return reply.status(400).send({ error: 'Details do not match our records.' });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

        return reply.send({ success: true, message: 'Password reset successfully.' });
    });
}