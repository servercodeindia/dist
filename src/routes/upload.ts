import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Configure Cloudinary if environment variables are present
(async () => {
  if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) {
    try {
      const { v2: cloud } = await import('cloudinary' as any);
      cloud.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
      });
      (globalThis as any).cloudinary = cloud;
      console.log('✅ Cloudinary configured for storage');
    } catch (err) {
      console.warn('⚠️ Cloudinary package not found. Fallback to local storage.');
    }
  }
})();

// Ensure uploads directory exists (for fallback/local use)
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Helper to upload to Cloudinary or Save Locally
async function handleFileUpload(base64Data: string, mimeType: string, filename: string) {
  const cloud = (globalThis as any).cloudinary;

  if (cloud) {
    const result = await cloud.uploader.upload(base64Data, {
      resource_type: 'auto',
      folder: 'twitfeed',
    });
    return { url: result.secure_url, filename: result.public_id };
  } else {
    const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
    const ext = mimeType.split('/')[1] === 'jpeg' ? '.jpg' : `.${mimeType.split('/')[1]}`;
    const savedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.writeFileSync(path.join(uploadDir, savedName), buffer);
    return { url: `/uploads/${savedName}`, filename: savedName };
  }
}

// Upload single file via base64
router.post('/single', authenticate as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { file, filename } = req.body;
    if (!file) { res.status(400).json({ error: 'No file provided' }); return; }
    if (!file.startsWith('data:')) { res.status(400).json({ error: 'Invalid format' }); return; }

    const mimeType = file.substring(5, file.indexOf(';'));
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav'];
    if (!allowed.includes(mimeType)) { res.status(400).json({ error: 'Invalid file type' }); return; }

    const { url, filename: savedName } = await handleFileUpload(file, mimeType, filename);
    res.json({ url, filename: savedName, originalName: filename || savedName });
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
      const mimeType = item.data.substring(5, item.data.indexOf(';'));
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowed.includes(mimeType)) continue;

      const { url, filename: savedName } = await handleFileUpload(item.data, mimeType, item.name);
      results.push({
        url,
        filename: savedName,
        originalName: item.name || savedName,
      });
    }

    res.json({ files: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
