import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifs = await prisma.notification.findMany({ where: { recipientId: req.user!.sub }, include: { actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json(notifs);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await prisma.notification.count({ where: { recipientId: req.user!.sub, isRead: false } });
    res.json({ count });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/read-all', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({ where: { recipientId: req.user!.sub, isRead: false }, data: { isRead: true } });
    res.json({ message: 'All marked read' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/read', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ message: 'Marked read' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

export default router;
