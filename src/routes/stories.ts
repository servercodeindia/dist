import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Create a story
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mediaUrl, mediaType, caption } = req.body;
    if (!mediaUrl) { res.status(400).json({ error: 'Media URL is required' }); return; }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        authorId: req.user!.sub,
        mediaUrl,
        mediaType: mediaType || 'IMAGE',
        caption: caption || null,
        expiresAt,
      },
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } },
    });

    res.status(201).json(story);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Get stories feed
router.get('/feed', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.sub;

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = [...following.map((f: { followingId: string }) => f.followingId), userId];

    const stories = await prisma.story.findMany({
      where: {
        authorId: { in: followingIds },
        expiresAt: { gt: new Date() },
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check which stories the current user has liked
    const storyIds = stories.map((s: any) => s.id);
    let likedStoryIds: string[] = [];
    try {
      const likes = await prisma.storyLike.findMany({
        where: { userId, storyId: { in: storyIds } },
        select: { storyId: true },
      });
      likedStoryIds = likes.map((l: any) => l.storyId);
    } catch {}

    const grouped: Record<string, { user: any; stories: any[] }> = {};
    for (const story of stories) {
      if (!grouped[story.authorId]) {
        grouped[story.authorId] = { user: story.author, stories: [] };
      }
      grouped[story.authorId].stories.push({
        ...story,
        isLiked: likedStoryIds.includes(story.id),
      });
    }

    const result = Object.values(grouped).sort((a, b) => {
      if (a.user.id === userId) return -1;
      if (b.user.id === userId) return 1;
      return 0;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Get stories by user
router.get('/user/:userId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stories = await prisma.story.findMany({
      where: {
        authorId: req.params.userId as string,
        expiresAt: { gt: new Date() },
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Check likes
    const storyIds = stories.map((s: any) => s.id);
    let likedStoryIds: string[] = [];
    try {
      const likes = await prisma.storyLike.findMany({
        where: { userId: req.user!.sub, storyId: { in: storyIds } },
        select: { storyId: true },
      });
      likedStoryIds = likes.map((l: any) => l.storyId);
    } catch {}

    res.json(stories.map((s: any) => ({ ...s, isLiked: likedStoryIds.includes(s.id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// View a story (unique per user)
router.post('/:storyId/view', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Use create to track unique views — catch duplicate constraint errors
    try {
      await prisma.storyView.create({
        data: { storyId: req.params.storyId as string, userId: req.user!.sub },
      });
      // Only increment if this is a new view
      await prisma.story.update({
        where: { id: req.params.storyId as string },
        data: { viewsCount: { increment: 1 } },
      });
    } catch {
      // Already viewed — ignore duplicate
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// Like/unlike a story
router.post('/:storyId/like', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const storyId = req.params.storyId as string;
    const userId = req.user!.sub;
    const existing = await prisma.storyLike.findUnique({
      where: { storyId_userId: { storyId, userId } },
    });
    if (existing) {
      await prisma.storyLike.delete({ where: { storyId_userId: { storyId, userId } } });
      res.json({ liked: false });
    } else {
      await prisma.storyLike.create({
        data: { storyId, userId },
      });
      // Send notification to story author
      const story = await prisma.story.findUnique({ where: { id: storyId }, select: { authorId: true } });
      if (story && story.authorId !== userId) {
        await prisma.notification.create({
          data: { recipientId: story.authorId, actorId: userId, type: 'STORY_LIKE', entityId: storyId, entityType: 'story' }
        }).catch(() => {});
      }
      res.json({ liked: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Reply to a story (creates a DM)
router.post('/:storyId/reply', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: 'Message content required' }); return; }

    const story = await prisma.story.findUnique({
      where: { id: req.params.storyId as string },
      include: { author: { select: { id: true, username: true, displayName: true } } },
    });
    if (!story) { res.status(404).json({ error: 'Story not found' }); return; }

    const senderId = req.user!.sub;
    const recipientId = story.authorId;

    if (senderId === recipientId) { res.status(400).json({ error: 'Cannot reply to your own story' }); return; }

    // Find or create conversation between sender and story author
    let convo = await prisma.conversation.findFirst({
      where: { AND: [{ participants: { some: { userId: senderId } } }, { participants: { some: { userId: recipientId } } }] },
    });

    if (!convo) {
      convo = await prisma.conversation.create({
        data: { participants: { create: [{ userId: senderId }, { userId: recipientId }] } },
      });
    }

    // Send message with story context
    const messageContent = `Replied to your story: "${content.trim()}"`;
    const message = await prisma.message.create({
      data: {
        conversationId: convo.id,
        senderId,
        content: messageContent,
        mediaUrl: story.mediaUrl, // Attach story media as context
      },
      include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });

    await prisma.conversation.update({ where: { id: convo.id }, data: { lastMessageAt: new Date() } });

    res.status(201).json({ success: true, conversationId: convo.id, message });

    // Send notification in background
    (async () => {
      try {
        await prisma.notification.create({
          data: { recipientId: recipientId, actorId: senderId, type: 'STORY_REPLY', entityId: req.params.storyId as string, entityType: 'story' }
        });
      } catch {}
    })();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Delete a story
router.delete('/:storyId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.storyId as string } });
    if (!story) { res.status(404).json({ error: 'Story not found' }); return; }
    if (story.authorId !== req.user!.sub) { res.status(403).json({ error: 'Unauthorized' }); return; }

    await prisma.story.delete({ where: { id: req.params.storyId as string } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

export default router;
