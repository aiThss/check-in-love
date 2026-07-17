import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
  findByIdUser: vi.fn(),
  findByIdCouple: vi.fn(),
  updateStreak: vi.fn().mockResolvedValue(1),
}));

vi.mock('../db/models/CheckIn', () => ({
  CheckIn: { findOne: mocks.findOne, create: mocks.create },
}));
vi.mock('../db/models/Couple', () => ({ Couple: { findById: mocks.findByIdCouple } }));
vi.mock('../db/models/User', () => ({ User: { findById: mocks.findByIdUser } }));
vi.mock('../middleware/auth', () => ({ authenticate: vi.fn() }));
vi.mock('../services/push', () => ({ sendPushToUser: vi.fn() }));
vi.mock('../services/storage', () => ({ storageService: { saveFile: vi.fn() } }));
vi.mock('../services/streak', () => ({ updateStreak: mocks.updateStreak }));
vi.mock('../config/env', () => ({ env: { MAX_UPLOAD_MB: 5 } }));
vi.mock('sharp', () => ({ default: vi.fn() }));

type Handler = (request: any, reply: any) => Promise<unknown>;

function createReply() {
  const reply = {
    status: vi.fn(),
    send: vi.fn((value) => value),
  };
  reply.status.mockReturnValue(reply);
  return reply;
}

async function getCreateHandler(): Promise<Handler> {
  const handlers = new Map<string, Handler>();
  const app = {
    get: vi.fn(),
    delete: vi.fn(),
    post: vi.fn((path: string, _options: unknown, handler: Handler) => handlers.set(path, handler)),
  };
  const { default: checkinsRoutes } = await import('./checkins');
  await checkinsRoutes(app as any);
  return handlers.get('/checkins')!;
}

describe('POST /checkins reply target validation', () => {
  const coupleId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const originalId = new Types.ObjectId();

  beforeEach(() => {
    vi.resetModules();
    mocks.findOne.mockReset();
    mocks.create.mockReset();
    mocks.findByIdUser.mockReset();
    mocks.findByIdCouple.mockReset();
    mocks.findByIdUser.mockReturnValue({ lean: vi.fn().mockResolvedValue({ displayName: 'Me' }) });
    mocks.findByIdCouple.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    mocks.create.mockResolvedValue({ _id: new Types.ObjectId() });
  });

  it('persists a server-derived reply snapshot only for a target in the same couple', async () => {
    const original = {
      _id: originalId,
      ownerId: new Types.ObjectId(),
      ownerName: 'Partner',
      type: 'text',
      caption: 'Tin nhắn gốc',
      coupleId,
    };
    mocks.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(original) });
    const handler = await getCreateHandler();
    const reply = createReply();

    await handler({
      user: { id: userId.toString(), coupleId: coupleId.toString() },
      headers: { 'content-type': 'application/json' },
      body: { type: 'text', caption: 'Trả lời', replyToMessageId: originalId.toString() },
    }, reply);

    expect(mocks.findOne).toHaveBeenCalledWith(expect.objectContaining({
      _id: expect.any(Types.ObjectId),
      coupleId: expect.any(Types.ObjectId),
      deletedAt: null,
    }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      replyToMessageId: originalId,
      replyTo: expect.objectContaining({
        messageId: originalId,
        senderName: 'Partner',
        textSnippet: 'Tin nhắn gốc',
      }),
    }));
  });

  it('rejects a reply target that is not visible in the current couple', async () => {
    mocks.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    const handler = await getCreateHandler();
    const reply = createReply();

    await handler({
      user: { id: userId.toString(), coupleId: coupleId.toString() },
      headers: { 'content-type': 'application/json' },
      body: { type: 'text', caption: 'Trả lời', replyToMessageId: originalId.toString() },
    }, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('keeps the legacy create request compatible when replyToMessageId is absent', async () => {
    const handler = await getCreateHandler();
    const reply = createReply();

    await handler({
      user: { id: userId.toString(), coupleId: coupleId.toString() },
      headers: { 'content-type': 'application/json' },
      body: { type: 'text', caption: 'Tin nhắn thường' },
    }, reply);

    expect(mocks.findOne).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ replyTo: undefined }));
  });
});
