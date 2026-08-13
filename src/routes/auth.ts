import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const AUTH_KEY = process.env.MSG91_AUTH_KEY!;
const TEMPLATE_ID = process.env.MSG91_OTP_TEMPLATE_ID!;

// In-memory OTP store
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatPhone(phone: string): string {
    let formatted = phone.replace(/^\+/, '').replace(/[\s-]/g, '');
    if (formatted.length === 10 && /^[6-9]\d{9}$/.test(formatted)) {
        formatted = '91' + formatted;
    }
    return formatted;
}

async function sendOtpSms(phone: string, otp: string): Promise<boolean> {
    const formattedPhone = formatPhone(phone);
    const requestBody = {
        template_id: TEMPLATE_ID,
        short_url: '0',
        recipients: [{ mobiles: formattedPhone, var: otp }],
    };
    console.log('[MSG91] Sending OTP:', { phone: formattedPhone, otp });
    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authkey': AUTH_KEY },
        body: JSON.stringify(requestBody),
    });
    const data = await res.json() as any;
    console.log('[MSG91] Response:', JSON.stringify(data));
    return res.ok && data.type === 'success';
}

export default async function authRoutes(fastify: FastifyInstance) {

    // POST /api/auth/send-otp
    // mode: 'register' | 'login'
    fastify.post('/send-otp', async (request, reply) => {
        const { phone, mode } = request.body as { phone: string; mode: 'register' | 'login' };

        if (!phone || phone.length !== 10) {
            return reply.status(400).send({ error: 'Enter a valid 10-digit phone number.' });
        }

        // Check if user exists
        const [existingUser] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

        if (mode === 'login' && !existingUser) {
            return reply.status(404).send({ error: 'No account found with this number. Please register first.' });
        }

        if (mode === 'register' && existingUser) {
            return reply.status(409).send({ error: 'This number is already registered. Please sign in instead.' });
        }

        const otp = generateOtp();
        otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

        const ok = await sendOtpSms(phone, otp);
        if (!ok) {
            otpStore.delete(phone);
            return reply.status(500).send({ error: 'Failed to send OTP. Try again.' });
        }

        console.log(`[OTP] ${phone}: ${otp}`);
        return reply.send({ message: 'OTP sent successfully.' });
    });

    // POST /api/auth/verify-otp
    fastify.post('/verify-otp', async (request, reply) => {
        const { phone, otp, name } = request.body as { phone: string; otp: string; name?: string };

        if (!phone || !otp) {
            return reply.status(400).send({ error: 'Phone and OTP are required.' });
        }

        const stored = otpStore.get(phone);
        if (!stored) {
            return reply.status(400).send({ error: 'OTP not found. Please request a new one.' });
        }
        if (Date.now() > stored.expiresAt) {
            otpStore.delete(phone);
            return reply.status(400).send({ error: 'OTP expired. Please request a new one.' });
        }
        if (stored.otp !== otp) {
            return reply.status(400).send({ error: 'Invalid OTP. Please try again.' });
        }

        otpStore.delete(phone);

        let [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

        if (!user) {
            // New user — save with name
            [user] = await db.insert(users)
                .values({ phone, name: name?.trim() || '' })
                .returning();
        }

        const token = fastify.jwt.sign(
            { id: user.id, name: user.name, phone: user.phone, plan: user.plan },
            { expiresIn: '30d' }
        );

        return reply.send({
            token,
            name: user.name,
            phone: user.phone,
            plan: user.plan,
            isNewUser: !user.name,
        });
    });

    // PATCH /api/auth/update-name
    fastify.patch('/update-name', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.user as any;
        const { name } = request.body as { name: string };
        if (!name?.trim()) return reply.status(400).send({ error: 'Name is required.' });
        const [user] = await db.update(users).set({ name: name.trim() }).where(eq(users.id, id)).returning();
        return reply.send({ name: user.name });
    });

    // GET /api/auth/me
    fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.user as any;
        const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        if (!user) return reply.status(404).send({ error: 'User not found.' });
        return reply.send({ name: user.name, phone: user.phone, plan: user.plan });
    });

    // PATCH /api/auth/update-profile
    fastify.patch('/update-profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.user as any;
        const { name } = request.body as { name: string };
        if (!name?.trim()) return reply.status(400).send({ error: 'Name is required.' });
        const [user] = await db.update(users).set({ name: name.trim() }).where(eq(users.id, id)).returning();
        return reply.send({ name: user.name });
    });

    // DELETE /api/auth/delete-account
    fastify.delete('/delete-account', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.user as any;
        await db.delete(users).where(eq(users.id, id));
        return reply.send({ success: true });
    });
}