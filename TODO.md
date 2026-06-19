- [ ] Revue du routing FastAPI existant (tickets router)
- [ ] Confirmer que GET /api/tickets/{id}/workflow est bien exposé dans backend/api/routes/tickets.py
- [ ] S’assurer que le endpoint applique les règles d’accès par rôle comme les autres endpoints tickets
- [ ] Vérifier l’implémentation côté services/workflow_service.py (construction du workflow + chargement des validations)
- [ ] Adapter le endpoint pour utiliser la méthode GLPIClient dédiée aux validations (get_ticket_validations) si nécessaire
- [ ] Lancer tests / vérifications rapides (python -m compileall, éventuellement un test curl en mock)

