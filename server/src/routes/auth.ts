import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  characterName: z.string().trim().min(1).max(24),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// Placeholder starting spread — real starting stats arrive with the class system.
const STARTING_STATS = {
  strength: 5,
  agility: 5,
  focus: 5,
  intelligence: 5,
  wisdom: 5,
  luck: 5,
};

authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
    return;
  }
  const { email, password, characterName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      character: {
        create: {
          name: characterName,
          ...STARTING_STATS,
        },
      },
    },
    include: { character: true },
  });

  const token = signAccessToken({ userId: user.id });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email },
    character: user.character,
  });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, include: { character: true } });
  const passwordMatches = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !passwordMatches) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signAccessToken({ userId: user.id });
  res.json({
    token,
    user: { id: user.id, email: user.email },
    character: user.character,
  });
});
