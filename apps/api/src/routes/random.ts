import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { RANDOM_CATEGORIES, RANDOM_PROMPTS } from '../constants';
import { RandomCategory, RandomEvent } from '../db/models/RandomEvent';
import { authenticate } from '../middleware/auth';

const categoryValues = [
  'questions',
  'snap',
  'today',
  'food',
  'universe',
] as const;

const drawBodySchema = z.object({
  category: z.enum(categoryValues).optional(),
});

export default async function randomRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /random/categories — All categories with usage counts
   */
  app.get(
    '/random/categories',
    { preHandler: authenticate },
    async (request, reply) => {
      const coupleId = new Types.ObjectId(request.user.coupleId);

      // Count usage per category for this couple
      const usageCounts = await RandomEvent.aggregate<{
        _id: RandomCategory;
        count: number;
      }>([
        { $match: { coupleId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]);

      const countMap = new Map<string, number>(
        usageCounts.map((u) => [u._id, u.count]),
      );

      const categories = RANDOM_CATEGORIES.map((cat) => ({
        ...cat,
        usageCount: countMap.get(cat.category) ?? 0,
      }));

      return reply.status(200).send({ categories });
    },
  );

  /**
   * GET /random/history — Recent random events for couple
   */
  app.get(
    '/random/history',
    { preHandler: authenticate },
    async (request, reply) => {
      const query = request.query as { limit?: string };
      const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '10', 10)));

      const events = await RandomEvent.find({
        coupleId: new Types.ObjectId(request.user.coupleId),
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return reply.status(200).send({ events });
    },
  );

  /**
   * POST /random/draw — Draw a random prompt
   */
  app.post(
    '/random/draw',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = drawBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      // Pick category
      let category: RandomCategory;
      if (parsed.data.category) {
        category = parsed.data.category;
      } else {
        const allCategories = categoryValues as readonly RandomCategory[];
        category =
          allCategories[Math.floor(Math.random() * allCategories.length)];
      }

      // Pick random prompt from category
      const prompts = RANDOM_PROMPTS[category];
      const chosen = prompts[Math.floor(Math.random() * prompts.length)];

      // Persist event
      const event = await RandomEvent.create({
        coupleId: new Types.ObjectId(request.user.coupleId),
        userId: new Types.ObjectId(request.user.id),
        category,
        prompt: chosen.prompt,
        detail: chosen.detail,
      });

      return reply.status(201).send({
        category,
        prompt: chosen.prompt,
        detail: chosen.detail ?? null,
        event,
      });
    },
  );
}
