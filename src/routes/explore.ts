import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { optionalAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/search', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string) || '';
    const [users, posts, hashtags, news] = await Promise.all([
      prisma.user.findMany({ where: { OR: [{ username: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }], isBanned: false }, select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true, bio: true }, take: 10 }),
      prisma.post.findMany({ where: { content: { contains: q, mode: 'insensitive' } }, include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.hashtag.findMany({ where: { name: { contains: q.replace('#', '').toLowerCase() } }, orderBy: { postsCount: 'desc' }, take: 10 }),
      // "News" is simulated by finding recent popular posts matching the query
      prisma.post.findMany({ 
        where: { 
          content: { contains: q, mode: 'insensitive' },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // last 7 days
        }, 
        include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } }, 
        orderBy: [{ likesCount: 'desc' }, { commentsCount: 'desc' }], 
        take: 10 
      })
    ]);
    res.json({ users, posts, hashtags, news });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/trending', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hashtags = await prisma.hashtag.findMany({ orderBy: { postsCount: 'desc' }, take: 10 });
    res.json(hashtags);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/media', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const posts = await prisma.post.findMany({
      where: { NOT: { mediaUrls: { equals: [] } } },
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30
    });
    res.json(posts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
