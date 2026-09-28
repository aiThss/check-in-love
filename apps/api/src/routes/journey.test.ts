import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNotification } from './journey';

const mocks = vi.hoisted(() => ({
  coupleFindById: vi.fn(),
  userFindById: vi.fn(),
  journeyFindOne: vi.fn(),
  journeySave: vi.fn(),
  emitRealtimeEvent: vi.fn(),
  sendPushToUser: vi.fn(),
}));

vi.mock('../db/models/Couple', () => ({
  Couple: {
    findById: mocks.coupleFindById,
  },
}));

vi.mock('../db/models/User', () => ({
  User: {
    findById: mocks.userFindById,
  },
}));

vi.mock('../db/models/CoupleJourney', () => {
  class MockCoupleJourney {
    public coupleId: any;
    public places: any[];
    public bucketItems: any[];
    public save: any;

    constructor(data: any) {
      this.coupleId = data.coupleId;
      this.places = data.places || [];
      this.bucketItems = data.bucketItems || [];
      this.save = mocks.journeySave.mockImplementation(async () => this);
    }

    static findOne = mocks.journeyFindOne;
  }

  return { CoupleJourney: MockCoupleJourney };
});

vi.mock('../middleware/auth', () => ({ authenticate: vi.fn() }));
vi.mock('./events', () => ({ emitRealtimeEvent: mocks.emitRealtimeEvent }));
vi.mock('../services/push', () => ({
  sendPushToUser: mocks.sendPushToUser.mockResolvedValue({}),
}));

type Handler = (request: any, reply: any) => Promise<unknown>;

function query<T>(value: T) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function createReply() {
  const reply = { status: vi.fn(), send: vi.fn((value) => value) };
  reply.status.mockReturnValue(reply);
  return reply;
}

async function getJourneyHandlers(): Promise<{
  get: Handler;
  put: Handler;
  sync: Handler;
}> {
  const handlers = new Map<string, Handler>();
  const app = {
    get: vi.fn((path: string, _options: unknown, handler: Handler) => handlers.set(`GET:${path}`, handler)),
    put: vi.fn((path: string, _options: unknown, handler: Handler) => handlers.set(`PUT:${path}`, handler)),
    post: vi.fn((path: string, _options: unknown, handler: Handler) => handlers.set(`POST:${path}`, handler)),
  };
  const { default: journeyRoutes } = await import('./journey');
  await journeyRoutes(app as any);
  return {
    get: handlers.get('GET:/journey')!,
    put: handlers.get('PUT:/journey')!,
    sync: handlers.get('POST:/journey/sync')!,
  };
}

describe('Couple Journey Routes', () => {
  const coupleId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const partnerId = new Types.ObjectId();

  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    const couple = { _id: coupleId, memberIds: [userId, partnerId] };
    mocks.coupleFindById.mockReturnValue(query(couple));
    mocks.userFindById.mockReturnValue(query({ displayName: 'Dương', avatarUrl: '/avatar.jpg' }));
    mocks.journeySave.mockResolvedValue({});
    mocks.sendPushToUser.mockResolvedValue({});
  });

  describe('buildNotification helper', () => {
    it('generates friendly notifications for adding or completing wishes', () => {
      const addNotif = buildNotification('add_bucket', 'Dương', 'Đi ngắm tuyết Sa Pa');
      expect(addNotif?.title).toContain('Điều ước mới');
      expect(addNotif?.body).toContain('Đi ngắm tuyết Sa Pa');

      const completeNotif = buildNotification('complete_bucket', 'Dương', 'Học làm gốm');
      expect(completeNotif?.title).toContain('Điều ước đã hoàn thành');
      expect(completeNotif?.body).toContain('Học làm gốm');
    });

    it('returns null for unknown action types', () => {
      expect(buildNotification(undefined, 'Dương')).toBeNull();
      expect(buildNotification('sync', 'Dương')).toBeNull();
    });
  });

  describe('GET /journey', () => {
    it('returns places and bucket items from cloud database', async () => {
      mocks.journeyFindOne.mockReturnValue(query({
        places: [{ id: 'p1', name: 'Đà Lạt', latitude: 11.9, longitude: 108.4, status: 'visited' }],
        bucketItems: [{ id: 'b1', title: 'Nấu ăn cùng nhau', category: 'cozy', completed: true }],
      }));

      const { get } = await getJourneyHandlers();
      const reply = createReply();
      const res = await get({
        user: { id: userId.toString(), coupleId: coupleId.toString() },
      }, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect((res as any).places).toHaveLength(1);
      expect((res as any).bucketItems[0].title).toBe('Nấu ăn cùng nhau');
    });
  });

  describe('PUT /journey', () => {
    it('persists journey updates, emits SSE to partner, and sends push notification when a wish is completed', async () => {
      const existingDoc = {
        coupleId,
        places: [],
        bucketItems: [],
        save: mocks.journeySave.mockResolvedValue(true),
      };
      mocks.journeyFindOne.mockResolvedValue(existingDoc);

      const { put } = await getJourneyHandlers();
      const reply = createReply();

      await put({
        user: { id: userId.toString(), coupleId: coupleId.toString() },
        body: {
          bucketItems: [{
            id: 'b-new',
            title: 'Đi Đà Lạt đón giáng sinh',
            category: 'travel',
            completed: true,
            completedDate: '2026-12-25',
          }],
          actionType: 'complete_bucket',
          itemTitle: 'Đi Đà Lạt đón giáng sinh',
        },
      }, reply);

      expect(existingDoc.save).toHaveBeenCalled();
      expect(mocks.emitRealtimeEvent).toHaveBeenCalledWith(
        partnerId.toString(),
        expect.objectContaining({
          type: 'journey.updated',
          title: expect.stringContaining('Điều ước đã hoàn thành'),
          journey: expect.objectContaining({
            bucketItems: expect.arrayContaining([
              expect.objectContaining({ title: 'Đi Đà Lạt đón giáng sinh' }),
            ]),
          }),
        }),
      );
      expect(mocks.sendPushToUser).toHaveBeenCalledWith(
        partnerId.toString(),
        expect.objectContaining({
          title: expect.stringContaining('Điều ước đã hoàn thành'),
          body: expect.stringContaining('Đi Đà Lạt đón giáng sinh'),
        }),
      );
    });
  });

  describe('POST /journey/sync', () => {
    it('merges local wishes from APK into existing cloud data without losing any items', async () => {
      const existingDoc = {
        coupleId,
        places: [{ id: 'p1', name: 'Đà Nẵng', latitude: 16.0, longitude: 108.2, status: 'visited' }],
        bucketItems: [{ id: 'b1', title: 'Uống trà sữa', category: 'dating', completed: false }],
        save: mocks.journeySave.mockResolvedValue(true),
      };
      mocks.journeyFindOne.mockResolvedValue(existingDoc);

      const { sync } = await getJourneyHandlers();
      const reply = createReply();

      const result = await sync({
        user: { id: userId.toString(), coupleId: coupleId.toString() },
        body: {
          localPlaces: [],
          localBucketItems: [
            // User had b1 completed locally in APK
            { id: 'b1', title: 'Uống trà sữa', category: 'dating', completed: true, completedDate: '2026-09-28' },
            // User had a new custom wish added locally in APK
            { id: 'b2-apk', title: 'Ngắm bình minh cùng nhau', category: 'travel', completed: false },
          ],
        },
      }, reply);

      expect(existingDoc.save).toHaveBeenCalled();
      expect(existingDoc.bucketItems).toHaveLength(2);
      expect(existingDoc.bucketItems[0].completed).toBe(true);
      expect(existingDoc.bucketItems[1].id).toBe('b2-apk');
      expect((result as any).bucketItems).toHaveLength(2);

      // Emits SSE event to partner with merged journey
      expect(mocks.emitRealtimeEvent).toHaveBeenCalledWith(
        partnerId.toString(),
        expect.objectContaining({
          type: 'journey.updated',
        }),
      );
    });
  });
});
