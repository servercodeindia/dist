import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/feed', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tab = (req.query.tab as string) || 'foryou';
    const cursor = Array.isArray(req.query.cursor) ? req.query.cursor[0] as string : req.query.cursor as string | undefined;
    const mediaOnly = req.query.mediaOnly === 'true';
    const categoryFilter = req.query.category as string | undefined;

    let whereClause: any = { parentId: null };
    if (tab === 'following') {
      const follows = await prisma.follow.findMany({ where: { followerId: req.user!.sub }, select: { followingId: true } });
      const followingIds = follows.map(f => f.followingId);
      // Only include posts from people the user is following
      whereClause.authorId = { in: followingIds };
    }
    
    if (mediaOnly) {
      // Fetch user's category preferences for personalized ranking
      const currentUser = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { categories: true } });
      const userCategories = new Set((currentUser?.categories || []).map((c: string) => c.toLowerCase()));

      // Fast path for Reels: fetch posts with video content
      const followFilter = tab === 'following' ? { authorId: whereClause.authorId } : {};
      const catFilter = categoryFilter ? { category: categoryFilter.toLowerCase() } : {};
      
      const videoPosts = await prisma.post.findMany({
        where: {
          parentId: null,
          ...followFilter,
          ...catFilter,
          NOT: { mediaUrls: { equals: [] } }
        },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
          repostOf: { include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } } }
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      // Filter to only posts that actually have video URLs
      const videoOnly = videoPosts.filter(p =>
        p.mediaUrls.some(url => /\.(mp4|webm|mov)$/i.test(url))
      );

      // --- Advanced Category-Aware Reels Ranking Algorithm ---
      const rankReels = (postsToRank: any[]) => {
        const now = Date.now();
        postsToRank.sort((a, b) => {
          const scoreA = (a.likesCount * 2) + (a.commentsCount * 4) + (a.repostsCount * 5) + (a.bookmarksCount * 6);
          const viewsA = a.viewsCount > 0 ? a.viewsCount : 1;
          const engagementRateA = scoreA / viewsA;
          const hoursA = (now - new Date(a.createdAt).getTime()) / (1000 * 60 * 60);
          let rankA = (engagementRateA * 1000) / Math.pow(hoursA + 2, 1.8);

          // Category boost: +30% if reel's category matches user's interests
          if (a.category && userCategories.has(a.category.toLowerCase())) {
            rankA *= 1.3;
          }

          const scoreB = (b.likesCount * 2) + (b.commentsCount * 4) + (b.repostsCount * 5) + (b.bookmarksCount * 6);
          const viewsB = b.viewsCount > 0 ? b.viewsCount : 1;
          const engagementRateB = scoreB / viewsB;
          const hoursB = (now - new Date(b.createdAt).getTime()) / (1000 * 60 * 60);
          let rankB = (engagementRateB * 1000) / Math.pow(hoursB + 2, 1.8);

          if (b.category && userCategories.has(b.category.toLowerCase())) {
            rankB *= 1.3;
          }

          const jitterA = rankA * (1 + (Math.random() * 0.1));
          const jitterB = rankB * (1 + (Math.random() * 0.1));

          return jitterB - jitterA;
        });
      };
      
      rankReels(videoOnly);

      let startIdx = 0;
      if (cursor) {
        const ci = videoOnly.findIndex(p => p.id === cursor);
        if (ci !== -1) startIdx = ci + 1;
      }
      const sliced = videoOnly.slice(startIdx, startIdx + 20);
      const hasMore = startIdx + 20 < videoOnly.length;
      const targetIds = sliced.map(p => p.repostOfId || p.id);
      const likes = await prisma.like.findMany({ where: { userId: req.user!.sub, postId: { in: targetIds } }, select: { postId: true } });
      const bookmarks = await prisma.bookmark.findMany({ where: { userId: req.user!.sub, postId: { in: targetIds } }, select: { postId: true } });
      const views = await prisma.postView.findMany({ where: { userId: req.user!.sub, postId: { in: targetIds } }, select: { postId: true } });
      const likedIds = likes.map(l => l.postId);
      const bmIds = bookmarks.map(b => b.postId);
      const viewedIds = views.map(v => v.postId);
      
      // Backfill mediaType for any video posts that aren't tagged
      const untagged = sliced.filter(p => p.mediaType !== 'VIDEO');
      if (untagged.length > 0) {
        await Promise.all(untagged.map(p => prisma.post.update({ where: { id: p.id }, data: { mediaType: 'VIDEO' } })));
      }

      res.json({
        posts: sliced.map(p => ({
          ...p,
          mediaType: 'VIDEO',
          isLiked: likedIds.includes(p.repostOfId || p.id),
          isBookmarked: bmIds.includes(p.repostOfId || p.id),
          isViewed: viewedIds.includes(p.repostOfId || p.id)
        })),
        nextCursor: hasMore ? sliced[sliced.length - 1].id : null
      });
      return;
    }

    let data;
    let hasMore;

    if (tab === 'foryou') {
      // Fetch user's category preferences for personalized ranking
      const currentUser = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { categories: true } });
      const userCategories = new Set((currentUser?.categories || []).map((c: string) => c.toLowerCase()));

      const posts = await prisma.post.findMany({
        where: whereClause,
        include: { 
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
          repostOf: { include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const rankPosts = (postsToRank: any[]) => {
        const now = Date.now();
        postsToRank.sort((a, b) => {
          // Weights for different interactions
          const scoreA = (a.likesCount * 2) + (a.commentsCount * 4) + (a.repostsCount * 5) + (a.bookmarksCount * 6);
          const viewsA = a.viewsCount > 0 ? a.viewsCount : 1;
          const engagementRateA = scoreA / viewsA;
          const hoursA = (now - new Date(a.createdAt).getTime()) / (1000 * 60 * 60);
          
          // Velocity = Engagement Rate / (Time + 2)^Gravity
          let rankA = (engagementRateA * 1000) / Math.pow(hoursA + 2, 1.8);

          // Category boost: +30% if post's category matches user's content interests
          if (a.category && userCategories.has(a.category.toLowerCase())) {
            rankA *= 1.3;
          }

          const scoreB = (b.likesCount * 2) + (b.commentsCount * 4) + (b.repostsCount * 5) + (b.bookmarksCount * 6);
          const viewsB = b.viewsCount > 0 ? b.viewsCount : 1;
          const engagementRateB = scoreB / viewsB;
          const hoursB = (now - new Date(b.createdAt).getTime()) / (1000 * 60 * 60);
          
          let rankB = (engagementRateB * 1000) / Math.pow(hoursB + 2, 1.8);

          if (b.category && userCategories.has(b.category.toLowerCase())) {
            rankB *= 1.3;
          }

          // Add a tiny random jitter (1-5%) so feeds don't look completely static on reload
          const jitterA = rankA * (1 + (Math.random() * 0.05));
          const jitterB = rankB * (1 + (Math.random() * 0.05));

          return jitterB - jitterA;
        });
      };

      rankPosts(posts);

      let startIndex = 0;
      if (cursor) {
        const cursorIndex = posts.findIndex(p => p.id === cursor);
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1;
        }
      }

      data = posts.slice(startIndex, startIndex + 20);
      hasMore = startIndex + 20 < posts.length;
    } else {
      const posts = await prisma.post.findMany({
        where: whereClause,
        include: { 
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
          repostOf: { include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } } }
        },
        orderBy: { createdAt: 'desc' },
        take: 21,
        ...(cursor && { cursor: { id: cursor }, skip: 1 })
      });
      hasMore = posts.length > 20;
      data = hasMore ? posts.slice(0, 20) : posts;
    }

    // Batch: fetch user's likes & bookmarks in parallel (2 queries instead of 22)
    const targetIds = data.map(p => p.repostOfId || p.id);
    const [likes, bookmarks, views] = await Promise.all([
      prisma.like.findMany({ where: { userId: req.user!.sub, postId: { in: targetIds } }, select: { postId: true } }),
      prisma.bookmark.findMany({ where: { userId: req.user!.sub, postId: { in: targetIds } }, select: { postId: true } }),
      prisma.postView.findMany({ where: { userId: req.user!.sub, postId: { in: targetIds } }, select: { postId: true } })
    ]);
    const likedIds = new Set(likes.map(l => l.postId));
    const bmIds = new Set(bookmarks.map(b => b.postId));
    const viewedIds = new Set(views.map(v => v.postId));
    
    res.json({ 
      posts: data.map(p => ({ 
        ...p, 
        isLiked: likedIds.has(p.repostOfId || p.id), 
        isBookmarked: bmIds.has(p.repostOfId || p.id),
        isViewed: viewedIds.has(p.repostOfId || p.id)
      })), 
      nextCursor: hasMore ? data[data.length - 1].id : null 
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/bookmarks', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cursor = Array.isArray(req.query.cursor) ? req.query.cursor[0] as string : req.query.cursor as string | undefined;
    const bookmarks = await prisma.bookmark.findMany({ 
      where: { userId: req.user!.sub }, 
      include: { 
        post: { 
          include: { 
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
            repostOf: { include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } } }
          } 
        } 
      }, 
      orderBy: { createdAt: 'desc' }, 
      take: 21, 
      ...(cursor && { cursor: { id: cursor }, skip: 1 }) 
    });
    const hasMore = bookmarks.length > 20;
    const data = hasMore ? bookmarks.slice(0, 20) : bookmarks;
    const postIds = data.map(b => b.postId);
    const views = await prisma.postView.findMany({ where: { userId: req.user!.sub, postId: { in: postIds } }, select: { postId: true } });
    const viewedIds = new Set(views.map(v => v.postId));
    res.json({ posts: data.map(b => ({ ...b.post, isBookmarked: true, isViewed: viewedIds.has(b.postId) })), nextCursor: hasMore ? data[data.length - 1].id : null });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const post = await prisma.post.findUnique({ 
      where: { id },
      include: { 
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        repostOf: { include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } } }
      } 
    });
    if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
    let isLiked = false, isBookmarked = false, isViewed = false;
    if (req.user) {
      isLiked = !!(await prisma.like.findFirst({ where: { userId: req.user.sub, postId: post.id } }));
      isBookmarked = !!(await prisma.bookmark.findFirst({ where: { userId: req.user.sub, postId: post.id } }));
      isViewed = !!(await prisma.postView.findFirst({ where: { userId: req.user.sub, postId: post.id } }));
    }
    res.json({ ...post, isLiked, isBookmarked, isViewed });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content, mediaUrls, repostOfId, category, location, audioUrl, audioTitle, audioArtist } = req.body;
    if (!content && (!mediaUrls || mediaUrls.length === 0) && !repostOfId) { res.status(400).json({ error: 'Content or media required' }); return; }
    
    // Detect if media is video
    const isVideo = mediaUrls?.some((url: string) => url.match(/\.(mp4|webm|mov)$/i));
    const finalMediaType = isVideo ? 'VIDEO' : (mediaUrls?.length ? 'IMAGE' : 'TEXT');
    
    // Auto-categorization Algorithm
    let finalCategory = category ? category.toLowerCase() : null;
    
    // If no category was explicitly provided (e.g. from the new invisible Reels upload),
    // let's try to automatically determine it based on the caption content/hashtags.
    if (!finalCategory && content && isVideo) {
      const text = content.toLowerCase();
      
      // Keyword to Category ID mapping
      const categoryMap: Record<string, string[]> = {
        'tech': ['code', 'programming', 'software', 'developer', 'react', 'javascript', 'tech', 'ai', 'computer'],
        'comedy': ['funny', 'haha', 'lmao', 'lol', 'comedy', 'hilarious', 'joke', 'meme'],
        'music': ['music', 'song', 'singing', 'cover', 'guitar', 'piano', 'beats', 'audio'],
        'dance': ['dance', 'dancing', 'choreography', 'ballet', 'hiphop'],
        'food': ['food', 'recipe', 'cooking', 'baking', 'delicious', 'tasty', 'snack'],
        'gaming': ['game', 'gaming', 'twitch', 'esports', 'fortnite', 'minecraft', 'playstation', 'xbox'],
        'fitness': ['gym', 'workout', 'fitness', 'exercise', 'muscle', 'lift', 'cardio'],
        'travel': ['travel', 'vacation', 'trip', 'explore', 'adventure', 'hotel', 'flight'],
        'cars': ['car', 'cars', 'racing', 'automotive', 'vehicle', 'drift', 'engine'],
        'sports': ['sports', 'football', 'basketball', 'soccer', 'tennis', 'athlete', 'match']
      };

      // Score each category based on keyword matches
      const scores: Record<string, number> = {};
      
      for (const [catId, keywords] of Object.entries(categoryMap)) {
        scores[catId] = 0;
        for (const word of keywords) {
          // Check for exact word matches or hashtag matches (e.g., "tech" or "#tech")
          const regex = new RegExp(`(?:\\b|#)${word}\\b`, 'g');
          const matches = text.match(regex);
          if (matches) {
            scores[catId] += matches.length;
          }
        }
      }

      // Find the category with the highest score (must be > 0)
      let bestCategory = null;
      let highestScore = 0;
      for (const [catId, score] of Object.entries(scores)) {
        if (score > highestScore) {
          highestScore = score;
          bestCategory = catId;
        }
      }

      if (bestCategory) {
        finalCategory = bestCategory;
      } else {
        // Fallback to digital creator if it's a video but no keywords matched
        finalCategory = 'digital_creator'; 
      }
    }

    const post = await prisma.post.create({ data: { authorId: req.user!.sub, content, mediaUrls: mediaUrls || [], mediaType: finalMediaType, repostOfId, category: finalCategory, audioUrl, audioTitle, audioArtist } as any, include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } } });
    await prisma.user.update({ where: { id: req.user!.sub }, data: { postsCount: { increment: 1 } } });
    
    // Handle Repost Logic
    if (repostOfId) {
      await prisma.post.update({
        where: { id: repostOfId },
        data: { repostsCount: { increment: 1 } },
      });
      const originalPost = await prisma.post.findUnique({ where: { id: repostOfId } });
      if (originalPost && originalPost.authorId !== req.user!.sub) {
        await prisma.notification.create({
          data: {
            recipientId: originalPost.authorId,
            actorId: req.user!.sub,
            type: 'REPOST',
            entityId: post.id,
            entityType: 'post'
          }
        });
      }
    }
    // Extract hashtags
    const hashtagRegex = /#(\w+)/g;
    let match;
    while ((match = hashtagRegex.exec(content || '')) !== null) {
      const name = match[1].toLowerCase();
      const hashtag = await prisma.hashtag.upsert({ where: { name }, create: { name, postsCount: 1 }, update: { postsCount: { increment: 1 } } });
      await prisma.postHashtag.create({ data: { postId: post.id, hashtagId: hashtag.id } }).catch(() => {});
    }
    res.status(201).json(post);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { content } = req.body;
    
    // Authorization check
    const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
    if (post.authorId !== req.user!.sub && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Not authorized' }); return;
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { content },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        _count: { select: { comments: true, likes: true, reposts: true, bookmarks: true } }
      }
    });

    res.json(updated);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
    if (post.authorId !== req.user!.sub && !req.user!.isAdmin) { res.status(403).json({ error: 'Forbidden' }); return; }
    
    const isRepost = !!post.repostOfId;
    
    // Run delete + counter updates in parallel
    const ops: Promise<any>[] = [
      prisma.post.delete({ where: { id } }),
      prisma.user.update({ where: { id: req.user!.sub }, data: { postsCount: { decrement: 1 } } }),
    ];
    if (isRepost) {
      ops.push(prisma.post.updateMany({ where: { id: post.repostOfId! }, data: { repostsCount: { decrement: 1 } } }));
    }
    await Promise.all(ops);

    res.json({ message: isRepost ? 'Repost removed' : 'Post deleted', isRepost });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/like', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.like.findFirst({ where: { userId: req.user!.sub, postId: id } });
    if (existing) {
      await Promise.all([
        prisma.like.delete({ where: { id: existing.id } }),
        prisma.post.update({ where: { id }, data: { likesCount: { decrement: 1 } } }),
        prisma.notification.deleteMany({ where: { recipientId: { not: req.user!.sub }, actorId: req.user!.sub, type: 'LIKE', entityId: id } }),
      ]);
      res.json({ liked: false });
    } else {
      await Promise.all([
        prisma.like.create({ data: { userId: req.user!.sub, postId: id } }),
        prisma.post.update({ where: { id }, data: { likesCount: { increment: 1 } } }),
      ]);
      const post = await prisma.post.findUnique({ where: { id } });
      if (post && post.authorId !== req.user!.sub) { 
        // Prevent duplicate LIKE notifications
        const existingNotif = await prisma.notification.findFirst({
          where: { recipientId: post.authorId, actorId: req.user!.sub, type: 'LIKE', entityId: post.id }
        });
        if (!existingNotif) {
          await prisma.notification.create({ data: { recipientId: post.authorId, actorId: req.user!.sub, type: 'LIKE', entityId: post.id, entityType: 'post' } }); 
        }
      }
      res.json({ liked: true });
    }
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/bookmark', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.bookmark.findFirst({ where: { userId: req.user!.sub, postId: id } });
    if (existing) { 
      await Promise.all([
        prisma.bookmark.delete({ where: { id: existing.id } }),
        prisma.post.update({ where: { id }, data: { bookmarksCount: { decrement: 1 } } }),
      ]);
      res.json({ bookmarked: false }); 
    } else { 
      await Promise.all([
        prisma.bookmark.create({ data: { userId: req.user!.sub, postId: id } }),
        prisma.post.update({ where: { id }, data: { bookmarksCount: { increment: 1 } } }),
      ]);
      res.json({ bookmarked: true }); 
    }
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/view', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existingView = await prisma.postView.findUnique({
      where: {
        postId_userId: {
          postId: id,
          userId: req.user!.sub
        }
      }
    });

    if (!existingView) {
      await prisma.$transaction([
        prisma.postView.create({
          data: {
            postId: id,
            userId: req.user!.sub
          }
        }),
        prisma.post.update({
          where: { id },
          data: { viewsCount: { increment: 1 } }
        })
      ]);
    }
    
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id/comments', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const comments = await prisma.comment.findMany({ 
      where: { postId: id, parentId: null }, 
      include: { 
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } 
      }, 
      orderBy: { createdAt: 'asc' }, 
      take: 50 
    });
    
    if (req.user) {
      const likedCommentIds = new Set(
        (await prisma.like.findMany({
          where: { userId: req.user.sub, commentId: { in: comments.map(c => c.id) } },
          select: { commentId: true }
        })).map((l) => l.commentId)
      );
      res.json(comments.map(c => ({ ...c, isLiked: likedCommentIds.has(c.id) })));
      return;
    }

    res.json(comments);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/comments', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: 'Content required' }); return; }
    
    const comment = await prisma.comment.create({ 
      data: { authorId: req.user!.sub, postId: id, content }, 
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } } 
    });
    
    // Respond immediately
    res.status(201).json(comment);

    // Run the rest in the background
    (async () => {
      try {
        const post = await prisma.post.update({ 
          where: { id }, 
          data: { commentsCount: { increment: 1 } },
          select: { authorId: true, id: true }
        });
        if (post && post.authorId !== req.user!.sub) { 
          await prisma.notification.create({ 
            data: { recipientId: post.authorId, actorId: req.user!.sub, type: 'COMMENT', entityId: post.id, entityType: 'post' } 
          }); 
        }
      } catch (err) {
        console.error('Failed to run background comment tasks:', err);
      }
    })();
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:postId/comments/:commentId/like', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const existing = await prisma.like.findUnique({ where: { userId_commentId: { userId: req.user!.sub, commentId } } });
    
    if (existing) {
      await prisma.$transaction([
        prisma.like.delete({ where: { id: existing.id } }),
        prisma.comment.update({ where: { id: commentId }, data: { likesCount: { decrement: 1 } } })
      ]);
      res.json({ liked: false });
    } else {
      await prisma.$transaction([
        prisma.like.create({ data: { userId: req.user!.sub, commentId } }),
        prisma.comment.update({ where: { id: commentId }, data: { likesCount: { increment: 1 } } })
      ]);
      res.json({ liked: true });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
