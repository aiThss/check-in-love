import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  messageFindOne: vi.fn(),
  messageCreate: vi.fn(),
  checkinFindOne: vi.fn(),
  userFindById: vi.fn(),
  coupleFindById: vi.fn(),
  sendPush: vi.fn(),
}));

vi.mock('../db/models/ChatMessage', () => ({
  ChatMessage: { findOne: mocks.messageFindOne, create: mocks.messageCreate },
}));
vi.mock('../db/models/CheckIn', () => ({ CheckIn: { findOne: mocks.checkinFindOne } }));
vi.mock('../db/models/Couple', () => ({ Couple: { findById: mocks.coupleFindById } }));
vi.mock('../db/models/User', () => ({ User: { findById: mocks.userFindById } }));
vi.mock('../middleware/auth', () => ({ authenticate: vi.fn() }));
vi.mock('../services/push', () => ({ sendPushToUser: mocks.sendPush }));
vi.mock('../services/storage', () => ({ storageService: { saveFile: vi.fn() } }));
vi.mock('../config/env', () => ({ env: { MAX_UPLOAD_MB: 5 } }));
vi.mock('sharp', () => ({ default: vi.fn() }));

type Handler = (request: any, reply: any) => Promise<unknown>;

function createReply() {
  const reply = { status: vi.fn(), send: vi.fn((value) => value) };
  reply.status.mockReturnValue(reply);
  return reply;
}

async function getCreateHandler(): Promise<Handler> {
  const handlers = new Map<string, Handler>();
  const app = {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    post: vi.fn((path: string, _options: unknown, handler: Handler) => handlers.set(path, handler)),
  };
  const { default: messagesRoutes } = await import('./messages');
  await messagesRoutes(app as any);
  return handlers.get('/messages')!;
}

describe('POST /messages', () => {
  const coupleId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.userFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ displayName: 'Me' }) });
    mocks.coupleFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    mocks.messageFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    mocks.messageCreate.mockResolvedValue({ _id: new Types.ObjectId(), type: 'text', text: 'Xin chào' });
  });

  it('persists a ChatMessage and never creates a CheckIn for a text message', async () => {
    const handler = await getCreateHandler();
    const reply = createReply();

    await handler({
      user: { id: userId.toString(), coupleId: coupleId.toString() },
      headers: { 'content-type': 'application/json' },
      body: { type: 'text', text: 'Xin chào', clientMutationId: 'client-1' },
    }, reply);

    expect(mocks.messageCreate).toHaveBeenCalledWith(expect.objectContaining({
      coupleId: expect.any(Types.ObjectId), senderId: expect.any(Types.ObjectId), type: 'text', text: 'Xin chào', clientMutationId: 'client-1',
    }));
    expect(mocks.checkinFindOne).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(201);
  });

  it('snapshots a referenced CheckIn without altering it', async () => {
    const checkinId = new Types.ObjectId();
    mocks.checkinFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({
      _id: checkinId, ownerId: userId, ownerName: 'Me', type: 'photo', imageUrl: '/uploads/photo.jpg', createdAt: new Date(), coupleId,
    }) });
    const handler = await getCreateHandler();

    await handler({
      user: { id: userId.toString(), coupleId: coupleId.toString() },
      headers: { 'content-type': 'application/json' },
      body: { type: 'text', text: 'Nhớ ảnh này', referencedCheckinId: checkinId.toString() },
    }, createReply());

    expect(mocks.checkinFindOne).toHaveBeenCalledWith(expect.objectContaining({ _id: expect.any(Types.ObjectId), coupleId: expect.any(Types.ObjectId) }));
    expect(mocks.messageCreate).toHaveBeenCalledWith(expect.objectContaining({
      referencedCheckinId: checkinId,
      referencedCheckin: expect.objectContaining({ checkinId, ownerName: 'Me' }),
    }));
  });
});
