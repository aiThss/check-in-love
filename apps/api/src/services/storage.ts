import type { AppConfig } from '../config/env';
import { AppError } from '../utils/errors';

const ALLOWED_EXTENSIONS = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
]);

function detectImageType(bytes: Uint8Array, declaredMime: string, fileName?: string): { mime: string; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { mime: 'image/gif', ext: 'gif' };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  // ISO BMFF (HEIC/HEIF/AVIF): 'ftyp' at bytes 4..7
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const lowerMime = declaredMime.toLowerCase();
    if (lowerMime.includes('heif')) return { mime: 'image/heif', ext: 'heif' };
    return { mime: 'image/heic', ext: 'heic' };
  }

  const normalizedMime = declaredMime.toLowerCase().split(';')[0].trim();
  const mappedExt = ALLOWED_EXTENSIONS.get(normalizedMime);
  if (mappedExt) {
    return { mime: normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime, ext: mappedExt };
  }

  const extMatch = fileName?.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (extMatch === 'jpg' || extMatch === 'jpeg') return { mime: 'image/jpeg', ext: 'jpg' };
  if (extMatch === 'png') return { mime: 'image/png', ext: 'png' };
  if (extMatch === 'webp') return { mime: 'image/webp', ext: 'webp' };
  if (extMatch === 'gif') return { mime: 'image/gif', ext: 'gif' };
  return null;
}

export interface StoredUpload {
  url: string;
  storagePath: string;
}

export function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).size === 'number'
  );
}

export async function saveUploadedImage(
  bucket: R2Bucket,
  config: AppConfig,
  file: File,
  folder: 'checkins' | 'avatars' | 'messages' | 'chat-backgrounds',
): Promise<StoredUpload> {
  const maxBytes = config.MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size <= 0) {
    throw new AppError('Tệp ảnh trống', 400, 'EMPTY_FILE');
  }
  if (file.size > maxBytes) {
    throw new AppError(`Ảnh vượt quá giới hạn ${config.MAX_UPLOAD_MB}MB`, 413, 'FILE_TOO_LARGE');
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const detected = detectImageType(bytes, file.type || '', file.name);
  if (!detected) {
    throw new AppError('Định dạng ảnh không được hỗ trợ (chỉ hỗ trợ JPG, PNG, WebP, GIF, HEIC)', 400, 'INVALID_IMAGE_TYPE');
  }

  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const key = `${folder}/${monthKey}/${crypto.randomUUID()}.${detected.ext}`;

  await bucket.put(key, bytes, {
    httpMetadata: {
      contentType: detected.mime,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  const url = config.R2_PUBLIC_URL
    ? `${config.R2_PUBLIC_URL}/${key}`
    : `${config.PUBLIC_BASE_URL}/uploads/${key}`;

  return { url, storagePath: key };
}

export async function deleteStoredFile(
  bucket: R2Bucket | undefined,
  storagePathOrUrl: string | null | undefined,
  r2PublicUrl?: string,
): Promise<void> {
  if (!bucket || !storagePathOrUrl) return;
  const trimmed = storagePathOrUrl.trim();
  if (!trimmed) return;

  let key: string;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const normalizedBase = (r2PublicUrl ?? '').replace(/\/+$/, '');
    if (normalizedBase && trimmed.startsWith(`${normalizedBase}/`)) {
      key = trimmed.slice(normalizedBase.length + 1);
    } else {
      const uploadsIndex = trimmed.indexOf('/uploads/');
      if (uploadsIndex >= 0) {
        key = trimmed.slice(uploadsIndex + '/uploads/'.length);
      } else {
        return;
      }
    }
  } else {
    key = trimmed.replace(/^\/+uploads\//, '').replace(/^\/+/, '');
  }

  if (!key) return;
  try {
    await bucket.delete(key);
  } catch {
    // Non-fatal storage cleanup error
  }
}
