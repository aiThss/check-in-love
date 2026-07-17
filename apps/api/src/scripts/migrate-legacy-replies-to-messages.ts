import mongoose, { Types } from 'mongoose';
import { connectDB } from '../db/connection';
import { ChatMessage } from '../db/models/ChatMessage';
import { CheckIn, ReplySubDoc } from '../db/models/CheckIn';

interface Options {
  apply: boolean;
  coupleId?: string;
  after?: Date;
}

function parseOptions(argv: string[]): Options {
  const options: Options = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') options.apply = true;
    if (argument === '--couple-id') options.coupleId = argv[index + 1];
    if (argument === '--after') options.after = new Date(argv[index + 1]);
  }
  if (options.coupleId && !Types.ObjectId.isValid(options.coupleId)) throw new Error('Invalid --couple-id');
  if (options.after && Number.isNaN(options.after.getTime())) throw new Error('Invalid --after date');
  return options;
}

function mutationId(checkinId: Types.ObjectId, reply: ReplySubDoc): string {
  return `legacy-reply:${checkinId}:${reply.userId}:${reply.createdAt.toISOString()}`;
}

async function migrate(options: Options): Promise<void> {
  const filter: Record<string, unknown> = { deletedAt: null, 'replies.0': { $exists: true } };
  if (options.coupleId) filter.coupleId = new Types.ObjectId(options.coupleId);
  if (options.after) filter.createdAt = { $gte: options.after };
  const totals = { scanned: 0, wouldCreate: 0, created: 0, skipped: 0, errors: 0 };

  for await (const checkin of CheckIn.find(filter).cursor()) {
    for (const reply of checkin.replies) {
      totals.scanned += 1;
      const clientMutationId = mutationId(checkin._id, reply);
      try {
        const existing = await ChatMessage.findOne({ coupleId: checkin.coupleId, clientMutationId }).lean();
        if (existing) {
          totals.skipped += 1;
          continue;
        }
        totals.wouldCreate += 1;
        if (!options.apply) continue;
        await ChatMessage.create({
          coupleId: checkin.coupleId,
          senderId: reply.userId,
          senderName: reply.userName,
          type: 'text',
          text: reply.message,
          referencedCheckinId: checkin._id,
          referencedCheckin: {
            checkinId: checkin._id,
            ownerId: checkin.ownerId,
            ownerName: checkin.ownerName,
            type: checkin.type,
            caption: checkin.caption ?? checkin.quickMessage,
            mood: checkin.mood,
            imageUrl: checkin.imageUrl,
            createdAt: checkin.createdAt,
          },
          clientMutationId,
          createdAt: reply.createdAt,
          updatedAt: reply.createdAt,
        });
        totals.created += 1;
      } catch (error) {
        // A duplicate-key race is safe: a concurrent run created the deterministic mutation already.
        if ((error as { code?: number }).code === 11000) totals.skipped += 1;
        else {
          totals.errors += 1;
          console.error(`Failed migrating reply on check-in ${checkin._id}:`, error);
        }
      }
    }
  }
  console.info(JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', ...totals }));
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  await connectDB();
  try {
    await migrate(options);
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
