import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

export interface StorageService {
  saveFile(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<{ url: string; storagePath: string }>;
  deleteFile(storagePath: string): Promise<void>;
}

class LocalStorageService implements StorageService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(uploadDir: string, baseUrl: string) {
    this.uploadDir = uploadDir;
    this.baseUrl = baseUrl;
  }

  async saveFile(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<{ url: string; storagePath: string }> {
    const ext = this.getExtFromMime(mimeType) ?? path.extname(filename) ?? '';
    const uniqueFilename = `${Date.now()}-${uuidv4()}${ext}`;

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const subDir = path.join(this.uploadDir, year, month);
    await fs.promises.mkdir(subDir, { recursive: true });

    const absolutePath = path.join(subDir, uniqueFilename);
    await fs.promises.writeFile(absolutePath, buffer);

    // Relative storage path: YYYY/MM/filename
    const storagePath = `${year}/${month}/${uniqueFilename}`;
    const url = `${this.baseUrl}/uploads/${storagePath}`;

    return { url, storagePath };
  }

  async deleteFile(storagePath: string): Promise<void> {
    const absolutePath = path.join(this.uploadDir, storagePath);
    try {
      await fs.promises.unlink(absolutePath);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== 'ENOENT') {
        throw err;
      }
      // File already gone — not an error
    }
  }

  private getExtFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/heic': '.heic',
      'image/heif': '.heif',
    };
    return map[mimeType] ?? '.bin';
  }
}

export const storageService: StorageService = new LocalStorageService(
  env.UPLOAD_DIR,
  env.PUBLIC_BASE_URL,
);
