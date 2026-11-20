import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

const COURSE_FILE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PDF_MIME_TYPES = new Set(['application/pdf']);

const UPLOAD_ROOT = path.resolve(
  process.env.FFCS_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'ffcs')
);

function safeSegment(value) {
  return String(value || 'anonymous')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

function extensionFor(file) {
  const original = path.extname(file.originalname || '').toLowerCase();
  if (original) return original.slice(0, 12);
  const byMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf'
  };
  return byMime[file.mimetype] || '';
}

function buildStorage(subfolder) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const userDir = path.join(UPLOAD_ROOT, subfolder, safeSegment(req.userId || req.adminIdentity));
      fs.mkdirSync(userDir, { recursive: true });
      cb(null, userDir);
    },
    filename(req, file, cb) {
      cb(null, `${Date.now()}-${crypto.randomUUID()}${extensionFor(file)}`);
    }
  });
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.FFCS_MAX_FILE_BYTES) || 20 * 1024 * 1024, files: 3 },
  fileFilter(req, file, cb) {
    if (!COURSE_FILE_MIME_TYPES.has(file.mimetype)) {
      const error = new Error('Unsupported file type. Allowed: JPG, JPEG, PNG, WEBP, PDF.');
      error.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(error);
    }
    return cb(null, true);
  }
});

const pdfUpload = multer({
  storage: buildStorage('curriculum'),
  limits: { fileSize: Number(process.env.FFCS_MAX_PDF_BYTES) || 25 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!PDF_MIME_TYPES.has(file.mimetype)) {
      const error = new Error('Unsupported file type. Only application/pdf is allowed.');
      error.code = 'UNSUPPORTED_PDF_TYPE';
      return cb(error);
    }
    return cb(null, true);
  }
});

function respondWithMulterError(res, error) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        code: 'TOO_MANY_SCREENSHOTS',
        message: 'Maximum 3 screenshots are allowed per course.'
      });
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        code: 'FILE_TOO_LARGE',
        message: 'Uploaded file exceeds the allowed size limit.'
      });
    }
    return res.status(400).json({
      success: false,
      code: error.code,
      message: error.message
    });
  }

  if (
    error?.code === 'UNSUPPORTED_IMAGE_TYPE' ||
    error?.code === 'UNSUPPORTED_PDF_TYPE' ||
    error?.code === 'UNSUPPORTED_FILE_TYPE'
  ) {
    return res.status(400).json({
      success: false,
      code: error.code,
      message: error.message
    });
  }

  return res.status(400).json({
    success: false,
    code: 'UPLOAD_FAILED',
    message: error?.message || 'File upload failed.'
  });
}

export function handleScreenshotUpload() {
  const middleware = imageUpload.array('screenshots', 3);
  return (req, res, next) =>
    middleware(req, res, (error) => {
      if (error) return respondWithMulterError(res, error);
      return next();
    });
}

export function handleCurriculumUpload() {
  const middleware = pdfUpload.single('curriculum');
  return (req, res, next) =>
    middleware(req, res, (error) => {
      if (error) return respondWithMulterError(res, error);
      return next();
    });
}

export { UPLOAD_ROOT };
