import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Upload single file via base64
router.post('/single', authenticate as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { file, filename } = req.body;
    if (!file) { res.status(400).json({ error: 'No file provided' }); return; }

    if (!file.startsWith('data:')) { res.status(400).json({ error: 'Invalid file format. Send as base64 data URI' }); return; }
    const commaIdx = file.indexOf(',');
    if (commaIdx === -1) { res.status(400).json({ error: 'Invalid file format' }); return; }

    const header = file.substring(5, commaIdx);
    const mimeType = header.split(';')[0];
    const base64Data = file.substring(commaIdx + 1);
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (!allowed.includes(mimeType)) { res.status(400).json({ error: 'Invalid file type' }); return; }

    // Validate size (50MB)
    if (buffer.length > 50 * 1024 * 1024) { res.status(400).json({ error: 'File too large (max 50MB)' }); return; }

    // Generate filename
    const ext = mimeType.split('/')[1] === 'jpeg' ? '.jpg' : `.${mimeType.split('/')[1]}`;
    const savedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(uploadDir, savedName);

    fs.writeFileSync(filePath, buffer);

    const url = `/uploads/${savedName}`;
    res.json({ url, filename: savedName, originalName: filename || savedName, size: buffer.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Upload multiple files via base64
router.post('/multiple', authenticate as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) { res.status(400).json({ error: 'No files provided' }); return; }
    if (files.length > 4) { res.status(400).json({ error: 'Maximum 4 files' }); return; }

    const results = [];
    for (const item of files) {
      if (!item.data || !item.data.startsWith('data:')) continue;
      const commaIdx = item.data.indexOf(',');
      if (commaIdx === -1) continue;

      const mimeType = item.data.substring(5, commaIdx).split(';')[0];
      const base64Data = item.data.substring(commaIdx + 1);
      const buffer = Buffer.from(base64Data, 'base64');
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowed.includes(mimeType)) continue;
      if (buffer.length > 50 * 1024 * 1024) continue;

      const ext = mimeType.split('/')[1] === 'jpeg' ? '.jpg' : `.${mimeType.split('/')[1]}`;
      const savedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      fs.writeFileSync(path.join(uploadDir, savedName), buffer);

      results.push({
        url: `/uploads/${savedName}`,
        filename: savedName,
        originalName: item.name || savedName,
        size: buffer.length,
      });
    }

    res.json({ files: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
