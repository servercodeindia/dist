import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

function generateTokens(user: { id: string; username: string; isAdmin: boolean }) {
  const accessToken = jwt.sign({ sub: user.id, username: user.username, isAdmin: user.isAdmin }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '7d' });
  return { accessToken };
}

router.post('/register', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, email, password, displayName } = req.body;
    if (!username || !email || !password) { res.status(400).json({ error: 'Username, email, and password required' }); return; }
    const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (exists) { res.status(409).json({ error: 'User already exists' }); return; }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { username, email, passwordHash, displayName: displayName || username } });
    const { accessToken } = generateTokens(user);
    res.status(201).json({ accessToken, user: { id: user.id, username: user.username, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, isAdmin: user.isAdmin } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    if (user.isBanned) { res.status(403).json({ error: 'Account suspended' }); return; }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    const actualPostsCount = await prisma.post.count({ where: { authorId: user.id, parentId: null } });
    const { accessToken } = generateTokens(user);
    res.json({ accessToken, user: { id: user.id, username: user.username, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, bio: user.bio, bannerUrl: user.bannerUrl, isVerified: user.isVerified, isAdmin: user.isAdmin, followersCount: user.followersCount, followingCount: user.followingCount, postsCount: actualPostsCount, createdAt: user.createdAt } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { id: true, username: true, email: true, displayName: true, bio: true, avatarUrl: true, bannerUrl: true, isVerified: true, isAdmin: true, followersCount: true, followingCount: true, postsCount: true, createdAt: true } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const actualPostsCount = await prisma.post.count({ where: { authorId: user.id, parentId: null } });
    res.json({ ...user, postsCount: actualPostsCount });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

export default router;
