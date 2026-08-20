# iOS Share Sheet preparation

The repository does not contain an Xcode project, so the iOS share extension is intentionally documented rather than fabricated.

When an iOS target is added, the Share Extension should:

1. Accept `public.image`, `public.url`, and `public.plain-text` from `NSExtensionContext`.
2. Store the shared item in an App Group container (for example `group.vn.couple.checkinlove`) with a short-lived record containing `text`, local file URL, MIME type, and creation time.
3. Open `https://couple.io.vn/app/messages?share=pending` through the containing app.
4. Let the authenticated PWA upload the item through `POST /api/messages` using the existing `clientMutationId` idempotency field, then delete the App Group record.

This matches the PWA Web Share Target and Android `ACTION_SEND` contract without touching other app tabs or storing private media in a web cache.
