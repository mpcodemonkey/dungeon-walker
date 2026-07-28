import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

export const meRouter = Router();

meRouter.get('/', requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { character: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    user: { id: user.id, email: user.email },
    character: user.character,
  });
});
