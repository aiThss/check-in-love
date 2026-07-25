import { createHash } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { ChatMessage } from '../db/models/ChatMessage';
import { CheckIn } from '../db/models/CheckIn';

function deterministicObjectId(dateValue: Date, identity: string): Types.ObjectId {
  const date = new Date(dateValue);
  const timestamp = Math.max(0, Math.floor(date.getTime() / 1000))
    .toString(16)
    .padStart(8, '0')
    .slice(-8);
  const suffix = createHash('sha1').update(identity).digest('hex').slice(0, 16);
  return new Types.ObjectId(`${timestamp}${suffix}`);
}

function messageSnippet(message: { text?: string; imageUrl?: string }): string {
  return (message.text?.replace(/\s+/g, ' ').trim() || (message.imageUrl ? 'Ảnh' : 'Tin nhắn'))
    .slice(0, 160);
}

/**
 * A reply entered from Home or Memories is stored on the CheckIn for the detail view.
 * Mirror the same reply into ChatMessage so it also appears in the Messages thread.
 *
 * The clientMutationId intentionally matches the legacy bridge in routes/messages.ts,
 * which keeps this write idempotent and prevents a later bridge pass from duplicating it.
 */
export function installCheckinReplyMessageSync(app: FastifyInstance): void {
  app.addHook('onResponse', async (request, response) => {
    if (
      request.method !== 'POST' ||
      response.statusCode < 200 ||
      response.statusCode >= 300 ||
      !/^\/api\/checkins\/[^/?]+\/replies(?:\?|$)/.test(request.url)
    ) {
      return;
    }

    try {
      const { id } = request.params as { id?: string };
      const { message } = (request.body ?? {}) as { message?: string };
      const checkinId = id?.trim();
      const replyMessage = message?.trim();

      if (!checkinId || !replyMessage || !Types.ObjectId.isValid(checkinId)) return;

      const checkIn = await CheckIn.findOne({
        _id: new Types.ObjectId(checkinId),
        coupleId: new Types.ObjectId(request.user.coupleId),
        deletedAt: null,
      }).lean();

      if (!checkIn) return;

      const replyRecord = [...(checkIn.replies ?? [])]
        .reverse()
        .find((item) =>
          item.userId.toString() === request.user.id && item.message === replyMessage,
        );

      if (!replyRecord) return;

      const createdAt = new Date(replyRecord.createdAt);
      const identity = [
        checkIn._id.toString(),
        replyRecord.userId.toString(),
        createdAt.toISOString(),
        replyRecord.message,
      ].join(':');
      const messageId = deterministicObjectId(createdAt, identity);
      const clientMutationId = `legacy-reply:${messageId.toString()}`;

      const sourceMessage = await ChatMessage.findOne({
        coupleId: checkIn.coupleId,
        referencedCheckinId: checkIn._id,
        type: 'image',
        deletedAt: null,
      })
        .sort({ createdAt: 1 })
        .lean();

      const referencedCheckin = {
        checkinId: checkIn._id,
        ownerId: checkIn.ownerId,
        ownerName: checkIn.ownerName,
        type: checkIn.type,
        caption: checkIn.caption ?? checkIn.quickMessage,
        mood: checkIn.mood,
        imageUrl: checkIn.imageUrl,
        createdAt: checkIn.createdAt,
      };

      await ChatMessage.updateOne(
        { coupleId: checkIn.coupleId, clientMutationId },
        {
          $setOnInsert: {
            _id: messageId,
            coupleId: checkIn.coupleId,
            senderId: replyRecord.userId,
            senderName: replyRecord.userName,
            type: 'text',
            text: replyRecord.message,
            ...(sourceMessage
              ? {
                  replyToMessageId: sourceMessage._id,
                  replyTo: {
                    messageId: sourceMessage._id,
                    senderId: sourceMessage.senderId,
                    senderName: sourceMessage.senderName,
                    type: sourceMessage.type,
                    textSnippet: messageSnippet(sourceMessage),
                    mediaUrl: sourceMessage.imageUrl,
                  },
                }
              : {
                  referencedCheckinId: checkIn._id,
                  referencedCheckin,
                }),
            clientMutationId,
            createdAt,
            updatedAt: createdAt,
            deletedAt: null,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      // The CheckIn reply is already saved. Keep the request successful and let the
      // existing legacy bridge retry this synchronization on the next Messages load.
      app.log.warn({ err: error }, 'Failed to mirror check-in reply into messages');
    }
  });
}
