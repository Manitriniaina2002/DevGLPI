# TODO

- [ ] Brancher `frontend/src/app/(authenticated)/dashboard/acheteur/page.tsx` sur `GET /api/dashboard/summary` via `useTickets` (end point Dashboard Summary)
- [ ] Conserver la logique UI existante (filtres/liste/Modal) en remplaçant les tickets fictifs par `summary.tickets` lorsque disponible
- [ ] Ajouter états `loading/error` et fallback sur données fictives si l’API ne renvoie pas la liste
- [ ] Vérifier build/typecheck Next.js
- [ ] Mettre à jour `useTickets` si l’API réelle renvoie une forme différente (tickets/summary)

