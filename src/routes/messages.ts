import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parts = await prisma.conversationParticipant.findMany({
      where: { userId: req.user!.sub },
      include: {
        conversation: {
          include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } }
        }
      }
    });
    
    let count = 0;
    for (const p of parts) {
      const lastMsg = p.conversation.messages[0];
      // Only count if the last message exists, wasn't sent by the current user, AND is newer than their last read time
      if (lastMsg && lastMsg.senderId !== req.user!.sub) {
        if (!p.lastReadAt || lastMsg.createdAt > p.lastReadAt) {
          count++;
        }
      }
    }
    res.json({ count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/conversations', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parts = await prisma.conversationParticipant.findMany({ where: { userId: req.user!.sub }, include: { conversation: { include: { participants: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, showActivityStatus: true, lastActiveAt: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } } } }, orderBy: { conversation: { lastMessageAt: 'desc' } } });
    const convos = parts.map(p => {
      const other = p.conversation.participants.find(pp => pp.userId !== req.user!.sub);
      return { id: p.conversation.id, theme: (p.conversation as any).theme || 'default', otherUser: other?.user, lastMessage: p.conversation.messages[0] || null, unread: p.lastReadAt ? p.conversation.messages[0]?.createdAt > p.lastReadAt : !!p.conversation.messages[0] };
    });
    res.json(convos);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/conversations', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ error: 'userId required' }); return; }
    
    const existing = await prisma.conversation.findFirst({ where: { AND: [{ participants: { some: { userId: req.user!.sub } } }, { participants: { some: { userId } } }] } });
    if (existing) { res.json({ id: existing.id }); return; }
    const convo = await prisma.conversation.create({ data: { participants: { create: [{ userId: req.user!.sub }, { userId }] } } });
    res.status(201).json({ id: convo.id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/conversations/:id/messages', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.id as string;
    const messages = await prisma.message.findMany({ 
      where: { conversationId, isDeleted: false }, 
      include: { 
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        replyTo: { include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } }
      }, 
      orderBy: { createdAt: 'asc' }, 
      take: 100 
    });
    await prisma.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId: req.user!.sub } }, data: { lastReadAt: new Date() } });
    res.json({ messages });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/conversations/:id/messages', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.id as string;
    const { content, mediaUrl, replyToId } = req.body;
    
    // Require either text content OR an attached file/image
    if (!content?.trim() && !mediaUrl) { 
      res.status(400).json({ error: 'Message content or attachment required' }); 
      return; 
    }
    
    const message = await prisma.message.create({ 
      data: { 
        conversationId, 
        senderId: req.user!.sub, 
        content: content?.trim() || null,
        mediaUrl: mediaUrl || null,
        replyToId: replyToId || null
      }, 
      include: { 
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } 
      } 
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
    await prisma.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId: req.user!.sub } }, data: { lastReadAt: new Date() } });
    res.status(201).json(message);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/conversations/:id/messages/:messageId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messageId = req.params.messageId as string;
    
    // Ensure the message actually belongs to this user before deleting
    const targetMsg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!targetMsg || targetMsg.senderId !== req.user!.sub) {
      res.status(403).json({ error: 'Unauthorized to delete this message' });
      return;
    }

    await prisma.message.delete({ where: { id: messageId } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.patch('/conversations/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.id as string;
    const { theme } = req.body;

    const convo = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { userId: req.user!.sub } }
      }
    });

    if (!convo) {
       res.status(404).json({ error: 'Conversation not found' });
       return;
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { theme }
    });

    res.json({ success: true, theme });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
