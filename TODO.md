# TODO — Vérification login Frontend & accès par rôle

- [x] Identifier le mismatch : backend renvoie `role=demandeur` (log), donc l’accès `/dashboard/acheteur` est refusé.
- [x] Renforcer RoleGuard : validation stricte du champ JWT `role` (uniquement valeurs autorisées).
- [ ] Corriger la navigation : rediriger vers le bon dashboard quand rôle != page.

- [ ] (Option) Basculer la page Acheteur en garde différente ou rediriger vers le bon dashboard selon rôle.
- [ ] Nettoyer / retirer les tickets fictifs si non nécessaires.



