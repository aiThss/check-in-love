import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

class R2StorageService implements StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucketName: string,
    publicUrl: string,
  ) {
    this.bucketName = bucketName;
    this.publicUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
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

    // Relative storage path: YYYY/MM/filename
    const storagePath = `${year}/${month}/${uniqueFilename}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: storagePath,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const url = `${this.publicUrl}/${storagePath}`;

    return { url, storagePath };
  }

  async deleteFile(storagePath: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: storagePath,
      })
    );
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

const isR2Configured =
  env.R2_ACCOUNT_ID &&
  env.R2_ACCESS_KEY_ID &&
  env.R2_SECRET_ACCESS_KEY &&
  env.R2_BUCKET_NAME &&
  env.R2_PUBLIC_URL;

export const storageService: StorageService = isR2Configured
  ? new R2StorageService(
      env.R2_ACCOUNT_ID!,
      env.R2_ACCESS_KEY_ID!,
      env.R2_SECRET_ACCESS_KEY!,
      env.R2_BUCKET_NAME!,
      env.R2_PUBLIC_URL!,
    )
  : new LocalStorageService(env.UPLOAD_DIR, env.PUBLIC_BASE_URL);
