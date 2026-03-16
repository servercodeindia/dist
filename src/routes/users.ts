import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/search', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string) || '';
    const users = await prisma.user.findMany({ where: { OR: [{ username: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }], isBanned: false }, select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true, isVerified: true, followersCount: true }, take: 20 });
    res.json(users);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/suggestions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const following = await prisma.follow.findMany({ where: { followerId: req.user!.sub }, select: { followingId: true } });
    const ids = following.map(f => f.followingId);
    const users = await prisma.user.findMany({ where: { id: { notIn: [...ids, req.user!.sub] }, isBanned: false }, select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true, isVerified: true, followersCount: true }, orderBy: { followersCount: 'desc' }, take: 10 });
    res.json(users);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:username', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const username = req.params.username as string;
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, bannerUrl: true, isVerified: true, followersCount: true, followingCount: true, postsCount: true, categories: true, createdAt: true, showActivityStatus: true, lastActiveAt: true, website: true, pronouns: true, gender: true, accountType: true } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const actualPostsCount = await prisma.post.count({ where: { authorId: user.id, parentId: null } });
    let isFollowing = false;
    if (req.user) { isFollowing = !!(await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: req.user.sub, followingId: user.id } } })); }
    res.json({ ...user, postsCount: actualPostsCount, isFollowing });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:username/analytics', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const username = req.params.username as string;
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true, followersCount: true, followingCount: true, postsCount: true } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    if (user.id !== req.user!.sub) { res.status(403).json({ error: 'Forbidden' }); return; }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // ===== BATCH 1: All independent queries in parallel =====
    const [posts, followers, followersGained] = await Promise.all([
      prisma.post.findMany({
        where: { authorId: user.id },
        select: { id: true, content: true, mediaUrls: true, mediaType: true, category: true, likesCount: true, commentsCount: true, repostsCount: true, bookmarksCount: true, viewsCount: true, createdAt: true }
      }),
      prisma.follow.findMany({
        where: { followingId: user.id },
        select: { followerId: true, follower: { select: { gender: true } } }
      }),
      prisma.follow.count({ where: { followingId: user.id, createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    // Compute aggregates (instant, in-memory)
    const totalLikes = posts.reduce((s, p) => s + p.likesCount, 0);
    const totalComments = posts.reduce((s, p) => s + p.commentsCount, 0);
    const totalReposts = posts.reduce((s, p) => s + p.repostsCount, 0);
    const totalBookmarks = posts.reduce((s, p) => s + p.bookmarksCount, 0);
    const totalViews = posts.reduce((s, p) => s + p.viewsCount, 0);
    const interactions = totalLikes + totalComments + totalReposts + totalBookmarks;
    const reach = totalViews; // Actual unique views represent reach better than a simulated formula
    const profileViews = followers.length; // Placeholder: real profile views would require a separate table, using followers as proxy or just 0
    const engagementRate = totalViews > 0 ? ((interactions) / totalViews * 100).toFixed(1) : '0.0';

    // Category breakdown (instant, in-memory)
    const categoryViews: Record<string, { views: number; likes: number; posts: number }> = {};
    posts.forEach(p => {
      const cat = p.category || 'uncategorized';
      if (!categoryViews[cat]) categoryViews[cat] = { views: 0, likes: 0, posts: 0 };
      categoryViews[cat].views += p.viewsCount;
      categoryViews[cat].likes += p.likesCount;
      categoryViews[cat].posts += 1;
    });

    // Reel analytics (instant, in-memory)
    const reels = posts
      .filter(p => p.mediaUrls.some(url => /\.(mp4|webm|mov)$/i.test(url)))
      .map(p => ({
        id: p.id, thumbnail: p.mediaUrls[0], caption: p.content?.substring(0, 60) || '',
        category: p.category, views: p.viewsCount, likes: p.likesCount,
        comments: p.commentsCount, shares: p.repostsCount, bookmarks: p.bookmarksCount,
        engagementRate: p.viewsCount > 0 ? ((p.likesCount + p.commentsCount + p.repostsCount) / p.viewsCount * 100).toFixed(1) : '0.0',
        createdAt: p.createdAt
      }))
      .sort((a, b) => b.views - a.views);

    // Gender demographics (instant, in-memory from followers already fetched)
    const genderCounts: Record<string, number> = {};
    followers.forEach(f => {
      const g = f.follower.gender || 'Not specified';
      genderCounts[g] = (genderCounts[g] || 0) + 1;
    });
    const totalFollowersSample = followers.length || 1;
    const genderColors: Record<string, string> = { 'Male': '#6366f1', 'Female': '#ec4899', 'Non-binary': '#a855f7', 'Not specified': '#6b7280', 'Prefer not to say': '#64748b' };
    const audienceGender = Object.entries(genderCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, value: Math.round((count / totalFollowersSample) * 100), color: genderColors[label] || '#8b5cf6' }));

    // Demographic countries
    const countries = [
      { name: 'India', code: 'IN', percent: 65 },
      { name: 'United States', code: 'US', percent: 20 },
      { name: 'United Kingdom', code: 'GB', percent: 10 },
      { name: 'Others', code: 'OT', percent: 5 }
    ];

    // ===== BATCH 2: Follower views + 7-day activity (all parallel) =====
    const postIds = posts.map(p => p.id);
    const followerIds = followers.map(f => f.followerId);
    
    const [followerViewCount, viewsByDay, likesByDay, followsByDay] = await Promise.all([
      postIds.length > 0 && followerIds.length > 0
        ? prisma.postView.count({ where: { postId: { in: postIds }, userId: { in: followerIds } } })
        : Promise.resolve(0),
      postIds.length > 0
        ? prisma.postView.groupBy({ by: ['viewedAt'], where: { postId: { in: postIds }, viewedAt: { gte: sevenDaysAgo } }, _count: true })
        : Promise.resolve([]),
      postIds.length > 0
        ? prisma.like.groupBy({ by: ['createdAt'], where: { postId: { in: postIds }, createdAt: { gte: sevenDaysAgo } }, _count: true })
        : Promise.resolve([]),
      prisma.follow.groupBy({ by: ['createdAt'], where: { followingId: user.id, createdAt: { gte: sevenDaysAgo } }, _count: true }),
    ]);

    const followerViews = followerViewCount as number;
    const nonFollowerViews = totalViews - followerViews;

    const dailyActivity = Array.from({ length: 7 }, (_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - i));
      const dayStr = day.toISOString().slice(0, 10);
      const dayLabel = day.toLocaleDateString('en-US', { weekday: 'short' });
      return {
        day: dayLabel,
        views: (viewsByDay as any[]).filter((v: any) => new Date(v.viewedAt).toISOString().slice(0, 10) === dayStr).reduce((s: number, v: any) => s + v._count, 0),
        likes: (likesByDay as any[]).filter((l: any) => new Date(l.createdAt).toISOString().slice(0, 10) === dayStr).reduce((s: number, l: any) => s + l._count, 0),
        follows: (followsByDay as any[]).filter((f: any) => new Date(f.createdAt).toISOString().slice(0, 10) === dayStr).reduce((s: number, f: any) => s + f._count, 0),
      };
    });

    res.json({
      reach, interactions, profileViews, totalLikes, totalComments, totalReposts,
      totalBookmarks, totalViews, followerViews, nonFollowerViews, followersGained,
      followersCount: user.followersCount, followingCount: user.followingCount,
      categoryViews, reels, audienceGender, countries, engagementRate, dailyActivity,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ===== Content Interests API =====
router.get('/me/interests', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { categories: true } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    // Recommended categories based on user's engagement (most liked/viewed post categories)
    const likedPosts = await prisma.like.findMany({
      where: { userId: req.user!.sub, postId: { not: null } },
      select: { post: { select: { category: true } } },
      take: 200,
      orderBy: { createdAt: 'desc' }
    });
    const viewedPosts = await prisma.postView.findMany({
      where: { userId: req.user!.sub },
      select: { post: { select: { category: true } } },
      take: 200,
      orderBy: { viewedAt: 'desc' }
    });

    // Count engagement per category
    const catEngagement: Record<string, number> = {};
    likedPosts.forEach(l => {
      const cat = l.post?.category;
      if (cat) catEngagement[cat] = (catEngagement[cat] || 0) + 2; // Likes weight 2
    });
    viewedPosts.forEach(v => {
      const cat = v.post?.category;
      if (cat) catEngagement[cat] = (catEngagement[cat] || 0) + 1; // Views weight 1
    });

    // Sort by engagement and exclude already-selected categories
    const selectedSet = new Set(user.categories);
    const recommended = Object.entries(catEngagement)
      .filter(([cat]) => !selectedSet.has(cat))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cat, score]) => ({ category: cat, score }));

    res.json({
      selected: user.categories,
      recommended,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/me/interests', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) { res.status(400).json({ error: 'Categories must be an array' }); return; }
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { categories },
      select: { categories: true }
    });
    res.json(user);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { displayName, bio, avatarUrl, bannerUrl, username, isPrivate, showActivityStatus, categories, website, pronouns, gender, accountType } = req.body;
    
    // Find current user context
    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!currentUser) { res.status(404).json({ error: 'User not found' }); return; }

    let targetUsername = currentUser.username;

    // Handle Username Update
    if (username && username !== currentUser.username) {
      const newUsername = username.toLowerCase();

      // 1. Validation (chars, underscores, max 1 dot)
      const usernameRegex = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/;
      if (!usernameRegex.test(newUsername) || newUsername.length < 3 || newUsername.length > 30) {
        res.status(400).json({ error: 'Username must be 3-30 characters, using only letters, numbers, underscores, and max 1 dot.' });
        return;
      }

      // 2. Uniqueness Check
      const existingUser = await prisma.user.findUnique({ where: { username: newUsername } });
      if (existingUser) {
        res.status(409).json({ error: 'This username is already taken. Please try another one.' });
        return;
      }

      // 3. Rate Limit Tracking (Max 5 changes per 30 minutes)
      const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentChangesCount = await prisma.usernameChange.count({
        where: {
          userId: req.user!.sub,
          createdAt: { gte: halfHourAgo }
        }
      });

      if (recentChangesCount >= 5) {
        res.status(429).json({ error: 'You have changed your username too many times. Please try again later.' });
        return;
      }

      // Prepare to log the change
      await prisma.usernameChange.create({
        data: {
          userId: req.user!.sub,
          newUsername: newUsername
        }
      });

      targetUsername = newUsername;
    }

    const user = await prisma.user.update({ 
      where: { id: req.user!.sub }, 
      data: { 
        ...(displayName !== undefined && { displayName }), 
        ...(bio !== undefined && { bio }), 
        ...(avatarUrl !== undefined && { avatarUrl }), 
        ...(bannerUrl !== undefined && { bannerUrl }),
        ...(isPrivate !== undefined && { isPrivate }),
        ...(showActivityStatus !== undefined && { showActivityStatus }),
        ...(categories !== undefined && { categories }),
        ...(website !== undefined && { website }),
        ...(pronouns !== undefined && { pronouns }),
        ...(gender !== undefined && { gender }),
        ...(accountType !== undefined && { accountType }),
        username: targetUsername
      } 
    });
    res.json(user);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/follow', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params.id as string;
    if (targetId === req.user!.sub) { res.status(400).json({ error: 'Cannot follow yourself' }); return; }
    const existing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: req.user!.sub, followingId: targetId } } });
    if (existing) {
      await prisma.follow.delete({ where: { followerId_followingId: { followerId: req.user!.sub, followingId: targetId } } });
      await prisma.user.update({ where: { id: req.user!.sub }, data: { followingCount: { decrement: 1 } } });
      await prisma.user.update({ where: { id: targetId }, data: { followersCount: { decrement: 1 } } });
      // Cleanup notification on unfollow
      await prisma.notification.deleteMany({
        where: {
          recipientId: targetId,
          actorId: req.user!.sub,
          type: 'FOLLOW'
        }
      });
      res.json({ following: false });
    } else {
      await prisma.follow.create({ data: { followerId: req.user!.sub, followingId: targetId } });
      await prisma.user.update({ where: { id: req.user!.sub }, data: { followingCount: { increment: 1 } } });
      await prisma.user.update({ where: { id: targetId }, data: { followersCount: { increment: 1 } } });
      
      // Prevent duplicate FOLLOW notifications
      const existingNotif = await prisma.notification.findFirst({
        where: { recipientId: targetId, actorId: req.user!.sub, type: 'FOLLOW' }
      });
      if (!existingNotif) {
        await prisma.notification.create({ data: { recipientId: targetId, actorId: req.user!.sub, type: 'FOLLOW', entityId: req.user!.sub, entityType: 'user' } });
      }
      res.json({ following: true });
    }
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/followers/:followerId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const followerId = req.params.followerId as string;
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: req.user!.sub } }
    });
    
    if (existing) {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId: req.user!.sub } }
      });
      await prisma.user.update({ where: { id: req.user!.sub }, data: { followersCount: { decrement: 1 } } });
      await prisma.user.update({ where: { id: followerId }, data: { followingCount: { decrement: 1 } } });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Follower not found' });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/followers', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params.id as string;
    const follows = await prisma.follow.findMany({ where: { followingId: targetId }, include: { follower: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } }, take: 50 });
    let mappedUsers: any[] = follows.map(f => f.follower);
    
    if (req.user && mappedUsers.length > 0) {
      const myFollows = await prisma.follow.findMany({
        where: { followerId: req.user.sub, followingId: { in: mappedUsers.map(u => u.id) } },
        select: { followingId: true }
      });
      const myFollowSet = new Set(myFollows.map(f => f.followingId));
      mappedUsers = mappedUsers.map(u => ({ ...u, isFollowing: myFollowSet.has(u.id) }));
    }
    
    res.json(mappedUsers);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id/following', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params.id as string;
    const follows = await prisma.follow.findMany({ where: { followerId: targetId }, include: { following: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } } }, take: 50 });
    let mappedUsers: any[] = follows.map(f => f.following);
    
    if (req.user && mappedUsers.length > 0) {
      const myFollows = await prisma.follow.findMany({
        where: { followerId: req.user.sub, followingId: { in: mappedUsers.map(u => u.id) } },
        select: { followingId: true }
      });
      const myFollowSet = new Set(myFollows.map(f => f.followingId));
      mappedUsers = mappedUsers.map(u => ({ ...u, isFollowing: myFollowSet.has(u.id) }));
    }
    
    res.json(mappedUsers);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id/posts', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params.id as string;
    const cursor = req.query.cursor as string | undefined;
    const tab = (req.query.tab as string) || 'posts';

    const authorSelect = { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true };
    const baseInclude = {
      author: { select: authorSelect },
      repostOf: { include: { author: { select: authorSelect } } },
      _count: { select: { likes: true, comments: true } }
    };
    const paginationOpts = { take: 21 as number, ...(cursor && { cursor: { id: cursor }, skip: 1 }) };

    let posts: any[] = [];

    if (tab === 'replies') {
      posts = await prisma.post.findMany({
        where: { authorId: targetId, parentId: { not: null } },
        include: { ...baseInclude, parent: { select: { id: true, content: true, author: { select: authorSelect } } } },
        orderBy: { createdAt: 'desc' },
        ...paginationOpts,
      });
    } else if (tab === 'likes') {
      const likes = await prisma.like.findMany({
        where: { userId: targetId, postId: { not: null } },
        select: { post: { include: baseInclude } },
        orderBy: { createdAt: 'desc' },
        ...paginationOpts,
      });
      posts = likes.map(l => l.post).filter(Boolean);
    } else if (tab === 'media') {
      posts = await prisma.post.findMany({
        where: { authorId: targetId, parentId: null, NOT: { mediaUrls: { equals: [] } } },
        include: baseInclude,
        orderBy: { createdAt: 'desc' },
        ...paginationOpts,
      });
    } else if (tab === 'reels') {
      const mediaPosts = await prisma.post.findMany({
        where: { authorId: targetId, parentId: null, NOT: { mediaUrls: { equals: [] } } },
        include: baseInclude,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      posts = mediaPosts.filter(p => p.mediaUrls.some((url: string) => /\.(mp4|webm|mov)$/i.test(url)));
      if (cursor) {
        const idx = posts.findIndex(p => p.id === cursor);
        if (idx !== -1) posts = posts.slice(idx + 1);
      }
      posts = posts.slice(0, 21);
    } else {
      posts = await prisma.post.findMany({
        where: { authorId: targetId, parentId: null },
        include: baseInclude,
        orderBy: { createdAt: 'desc' },
        ...paginationOpts,
      });
    }

    const hasMore = posts.length > 20;
    const data = hasMore ? posts.slice(0, 20) : posts;
    
    const postIds = data.map((p: any) => p.id);
    let likedIds: string[] = [];
    let bmIds: string[] = [];
    let viewedIds: string[] = [];
    if (req.user && postIds.length > 0) {
      const [likes, bookmarks, views] = await Promise.all([
        prisma.like.findMany({ where: { userId: req.user.sub, postId: { in: postIds } }, select: { postId: true } }),
        prisma.bookmark.findMany({ where: { userId: req.user.sub, postId: { in: postIds } }, select: { postId: true } }),
        prisma.postView.findMany({ where: { userId: req.user.sub, postId: { in: postIds } }, select: { postId: true } }),
      ]);
      likedIds = likes.map(l => l.postId!);
      bmIds = bookmarks.map(b => b.postId);
      viewedIds = views.map(v => v.postId);
    }
    
    res.json({
      posts: data.map((p: any) => ({
        ...p,
        likesCount: p._count?.likes ?? p.likesCount ?? 0,
        commentsCount: p._count?.comments ?? p.commentsCount ?? 0,
        isLiked: likedIds.includes(p.id),
        isBookmarked: bmIds.includes(p.id),
        isViewed: viewedIds.includes(p.id),
      })),
      nextCursor: hasMore ? data[data.length - 1].id : null,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

export default router;
