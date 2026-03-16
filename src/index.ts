import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import exploreRoutes from './routes/explore.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/upload.js';
import storyRoutes from './routes/stories.js';

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use((req, _res, next) => { console.log(`${new Date().toISOString()} ${req.method} ${req.url}`); next(); });

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stories', storyRoutes);

app.get('/', (_req, res) => { res.send('TwitFeed API Server is running'); });
app.get('/favicon.ico', (_req, res) => { res.status(204).end(); });
app.get('/api/health', (_req, res) => { res.json({ status: 'ok', ts: new Date().toISOString() }); });

// Serve frontend build from root dist folder
const distPath = path.join(process.cwd(), '..', 'dist');
app.use(express.static(distPath));

// Fallback to index.html for React Router
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use((_req, res) => { res.status(404).json({ error: 'Not found' }); });
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(err); res.status(500).json({ error: 'Internal error' }); });

app.listen(PORT, () => { console.log(`🚀 TwitFeed API on http://localhost:${PORT}`); });
export default app;
