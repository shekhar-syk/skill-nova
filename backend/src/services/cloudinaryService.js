import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { config } from '../config/env.js';

const isCloudinaryConfigured = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/zip',
  'text/plain',
]);

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Unsupported file type. Allowed: JPG, PNG, WEBP, PDF, ZIP, TXT.'));
    }
    cb(null, true);
  },
});

export async function uploadBufferToMedia(file, folder = 'skillnova/uploads') {
  if (!file || !file.buffer) {
    throw new Error('No file provided.');
  }

  if (!isCloudinaryConfigured) {
    // Store non-disk metadata or safe data URL for images so local Render disk is never used
    const isImage = file.mimetype.startsWith('image/');
    if (isImage && file.size <= 1024 * 1024) {
      const b64 = file.buffer.toString('base64');
      return {
        url: `data:${file.mimetype};base64,${b64}`,
        publicId: `local-inline-${Date.now()}`,
        provider: 'inline-preview',
        originalName: file.originalname,
      };
    }
    return {
      url: `https://res.cloudinary.com/skillnova-demo/raw/upload/${Date.now()}-${encodeURIComponent(file.originalname)}`,
      publicId: `sandbox-${Date.now()}`,
      provider: 'sandbox-metadata',
      originalName: file.originalname,
    };
  }

  return new Promise((resolve, reject) => {
    const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          provider: 'cloudinary',
          originalName: file.originalname,
        });
      }
    );
    stream.end(file.buffer);
  });
}
