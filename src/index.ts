import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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

const ALLOWED_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
console.log(`🔒 CORS allowed for: ${ALLOWED_ORIGIN}`);
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => { console.log(`${new Date().toISOString()} ${req.method} ${req.url}`); next(); });

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stories', storyRoutes);

app.get('/favicon.ico', (_req: express.Request, res: express.Response) => { res.status(204).end(); });
app.get('/api/health', (_req: express.Request, res: express.Response) => { res.json({ status: 'ok', ts: new Date().toISOString() }); });

// Serve frontend build from internal folders
const distPath = path.join(process.cwd(), 'dist');
const publicPath = path.join(process.cwd(), 'public');
const staticPath = fs.existsSync(distPath) ? distPath : (fs.existsSync(publicPath) ? publicPath : null);

if (staticPath) {
  console.log(`📂 Serving frontend from: ${staticPath}`);
  app.use(express.static(staticPath));
}

// Fallback to index.html for React Router
app.get(/.*/, (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
    return next();
  }
  if (staticPath) {
    res.sendFile(path.join(staticPath, 'index.html'));
  } else {
    // Final fallback if no static path found
    if (req.url === '/') {
       res.send('TwitFeed API Server is running (Frontend not found in dist/ or public/)');
       return;
    }
    next();
  }
});

app.use((_req: express.Request, res: express.Response) => { res.status(404).json({ error: 'Not found' }); });
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(err); res.status(500).json({ error: 'Internal error' }); });

app.listen(PORT, '0.0.0.0', () => { console.log(`🚀 TwitFeed API is running on port ${PORT}`); });
export default app;
