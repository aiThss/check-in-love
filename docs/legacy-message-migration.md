# Legacy message migration

`CheckIn.replies` remains the legacy source of truth for old clients. The migration below is opt-in and never runs during API startup.

Run a dry-run first (the default):

```powershell
npx tsx apps/api/src/scripts/migrate-legacy-replies-to-messages.ts --couple-id <coupleId>
```

Add `--apply` only after reviewing the reported counts. Each migrated reply receives a deterministic `clientMutationId`, so a repeat run skips records already copied. It never deletes or changes the original CheckIn reply.

Top-level historical CheckIns are deliberately not migrated: the database has no reliable discriminator between a real check-in and a former chat message. Migrate those only from an explicitly reviewed list of CheckIn IDs in a future, separate operation.
