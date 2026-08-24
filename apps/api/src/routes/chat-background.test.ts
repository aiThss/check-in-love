import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  coupleFindById: vi.fn(),
  coupleFindByIdAndUpdate: vi.fn(),
  userFindById: vi.fn(),
  messageCreate: vi.fn(),
  emitRealtimeEvent: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock('../db/models/Couple', () => ({
  Couple: {
    findById: mocks.coupleFindById,
    findByIdAndUpdate: mocks.coupleFindByIdAndUpdate,
  },
}));
vi.mock('../db/models/User', () => ({ User: { findById: mocks.userFindById } }));
vi.mock('../db/models/ChatMessage', () => ({ ChatMessage: { create: mocks.messageCreate } }));
vi.mock('../middleware/auth', () => ({ authenticate: vi.fn() }));
vi.mock('../services/storage', () => ({
  storageService: { saveFile: vi.fn(), deleteFile: mocks.deleteFile },
}));
vi.mock('../config/env', () => ({ env: { MAX_UPLOAD_MB: 5 } }));
vi.mock('./events', () => ({ emitRealtimeEvent: mocks.emitRealtimeEvent }));

type Handler = (request: any, reply: any) => Promise<unknown>;

function query<T>(value: T) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function createReply() {
  const reply = { status: vi.fn(), send: vi.fn((value) => value) };
  reply.status.mockReturnValue(reply);
  return reply;
}

async function getPatchHandler(): Promise<Handler> {
  const handlers = new Map<string, Handler>();
  const app = {
    get: vi.fn(),
    patch: vi.fn((path: string, _options: unknown, handler: Handler) => handlers.set(path, handler)),
  };
  const { default: chatBackgroundRoutes } = await import('./chat-background');
  await chatBackgroundRoutes(app as any);
  return handlers.get('/chat-background')!;
}

describe('PATCH /chat-background', () => {
  const coupleId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const partnerId = new Types.ObjectId();

  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    const couple = { _id: coupleId, memberIds: [userId, partnerId] };
    mocks.coupleFindById.mockReturnValue(query(couple));
    mocks.coupleFindByIdAndUpdate.mockReturnValue(query(couple));
    mocks.userFindById.mockReturnValue(query({ displayName: 'Thúy Hà' }));
    mocks.messageCreate.mockResolvedValue({ _id: new Types.ObjectId() });
  });

  it('stores the shared preset and persists a compact system event for both members', async () => {
    const handler = await getPatchHandler();
    const reply = createReply();

    const result = await handler({
      user: { id: userId.toString(), coupleId: coupleId.toString() },
      headers: { 'content-type': 'application/json' },
      body: { kind: 'preset', id: 'lavender-stars' },
    }, reply);

    expect(mocks.coupleFindByIdAndUpdate).toHaveBeenCalledWith(
      coupleId,
      { $set: { chatBackground: expect.objectContaining({ kind: 'preset', id: 'lavender-stars', label: 'Đồi lavender' }) } },
      { new: true, runValidators: true },
    );
    expect(mocks.messageCreate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'text',
      senderName: 'Thúy Hà',
      text: 'Thúy Hà đã đổi chủ đề thành Đồi lavender',
      systemEvent: expect.objectContaining({
        kind: 'background_changed',
        backgroundKind: 'preset',
        backgroundId: 'lavender-stars',
      }),
    }));
    expect(mocks.emitRealtimeEvent).toHaveBeenCalledWith(partnerId.toString(), expect.objectContaining({
      type: 'chat.background.updated',
      title: '',
      body: '',
      chatBackground: expect.objectContaining({ id: 'lavender-stars', label: 'Đồi lavender' }),
    }));
    expect((result as any).background).toEqual(expect.objectContaining({ id: 'lavender-stars' }));
    expect(reply.status).toHaveBeenCalledWith(200);
  });
});
