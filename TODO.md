# Integration completion checklist

## Plan
- [x] Update frontend hooks to send JWT as `Authorization: Bearer <token>` (backend requires this).
- [x] Make `dashboard/acheteur/page.tsx` use backend data read-only (no status/comments/uploads endpoints exist).
- [ ] Make `/dashboard` redirect to the correct role route based on JWT (`demandeur|acheteur|responsable`).
- [ ] Ensure routes for all roles exist (create `demandeur` page or adjust redirect/cards).

## Notes
Backend does not currently expose endpoints for updating tickets/comments/attachments, so buyer UI must be read-only for now.

