import { apiFetch } from './client';
import { store } from '../store/index';
// Map raw backend check-in format to aligned PWA types
function mapCheckin(item) {
    if (!item)
        return null;
    const currentUserId = store.get().user?.id;
    // Aggregate reactions: Group raw reactions by emoji/type
    const rawReactions = item.reactions || [];
    const reactionGroups = {};
    rawReactions.forEach((rx) => {
        const type = rx.type;
        const emojiMap = {
            heart: '❤️',
            hug: '🤗',
            kiss: '💋',
            laugh: '😂',
            miss: '🥺',
            '❤️': '❤️',
            '🤗': '🤗',
            '💋': '💋',
            '😂': '😂',
            '🥺': '🥺'
        };
        const emoji = emojiMap[type] || type;
        if (!reactionGroups[emoji]) {
            reactionGroups[emoji] = { count: 0, reactedByMe: false };
        }
        reactionGroups[emoji].count++;
        if (currentUserId && rx.userId === currentUserId) {
            reactionGroups[emoji].reactedByMe = true;
        }
    });
    const reactionsList = Object.keys(reactionGroups).map(type => ({
        type: type,
        count: reactionGroups[type].count,
        reactedByMe: reactionGroups[type].reactedByMe
    }));
    return {
        id: item._id || item.id,
        userId: item.ownerId || item.userId,
        coupleId: item.coupleId,
        type: item.type,
        photoUrl: item.imageUrl || item.photoUrl,
        caption: item.caption,
        mood: item.mood,
        reactions: reactionsList,
        ownerName: item.ownerName,
        isOwn: currentUserId ? (item.ownerId || item.userId) === currentUserId : false,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
    };
}
export async function getLatestPartnerCheckin() {
    try {
        const res = await apiFetch('/checkins/latest-partner');
        return res && res.checkIn ? mapCheckin(res.checkIn) : null;
    }
    catch {
        return null;
    }
}
export async function getCheckins(page = 1, limit = 20) {
    const res = await apiFetch('/checkins?page=' + page + '&limit=' + limit);
    const data = (res.checkIns || []).map(mapCheckin);
    const total = res.pagination?.total ?? data.length;
    const totalPages = res.pagination?.totalPages ?? 1;
    const hasMore = page < totalPages;
    return {
        data,
        total,
        page,
        limit,
        hasMore
    };
}
export async function createCheckin(body) {
    const res = await apiFetch('/checkins', {
        method: 'POST',
        body: body instanceof FormData ? body : JSON.stringify(body),
    });
    return mapCheckin(res.checkIn || res);
}
export async function addReaction(checkinId, type) {
    const nameMap = {
        '❤️': 'heart',
        '🤗': 'hug',
        '💋': 'kiss',
        '😂': 'laugh',
        '🥺': 'miss'
    };
    const backendType = nameMap[type] || type;
    const res = await apiFetch(`/checkins/${checkinId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ type: backendType }),
    });
    const currentUserId = store.get().user?.id;
    const reactionGroups = {};
    const rawReactions = res.reactions || [];
    rawReactions.forEach((rx) => {
        const emojiMap = {
            heart: '❤️',
            hug: '🤗',
            kiss: '💋',
            laugh: '😂',
            miss: '🥺',
            '❤️': '❤️',
            '🤗': '🤗',
            '💋': '💋',
            '😂': '😂',
            '🥺': '🥺'
        };
        const emoji = emojiMap[rx.type] || rx.type;
        if (!reactionGroups[emoji]) {
            reactionGroups[emoji] = { count: 0, reactedByMe: false };
        }
        reactionGroups[emoji].count++;
        if (currentUserId && rx.userId === currentUserId) {
            reactionGroups[emoji].reactedByMe = true;
        }
    });
    return Object.keys(reactionGroups).map(t => ({
        type: t,
        count: reactionGroups[t].count,
        reactedByMe: reactionGroups[t].reactedByMe
    }));
}
export function deleteCheckin(checkinId) {
    return apiFetch(`/checkins/${checkinId}`, {
        method: 'DELETE',
    });
}
