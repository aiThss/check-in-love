import mongoose from 'mongoose';
import { buildApp } from '../src/app';
import { connectDB } from '../src/db/connection';

let appInstance: any = null;

export default async function handler(req: any, res: any) {
  // 1. Connect to MongoDB Atlas if not already connected
  if (mongoose.connection.readyState < 1) {
    try {
      await connectDB();
    } catch (err) {
      console.error('Failed to connect to MongoDB Atlas:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Database connection failed' }));
      return;
    }
  }

  // 2. Build Fastify application if not cached
  if (!appInstance) {
    try {
      appInstance = await buildApp();
    } catch (err) {
      console.error('Failed to build Fastify application:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Server initialization failed' }));
      return;
    }
  }

  // 3. Wait for Fastify to be ready
  await appInstance.ready();

  // 4. Delegate request handling to Fastify
  appInstance.server.emit('request', req, res);
}
