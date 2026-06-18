- [x] Corriger backend/repositories/ticket_repository.py : bloc `if logs:`
  - [x] Dédupliquer les entrées (par id/type/date) pour éviter toute perte
  - [x] Garantir l’exhaustivité : détecter aussi les entrées « change » via old_value/new_value/linked_action/id_search_option (même si action/log est vide)
  - [x] Remplir champ/mise_a_jour pour les logs « change » (old_value -> new_value)
  - [x] Supprimer le code dupliqué champ/mise_a_jour (le double reset)
- [ ] Mettre à jour/valider le tri (date_mod/date_creation/date_creation) si nécessaire
- [ ] Exécuter test manuel : /api/tickets/26/history et vérifier l’affichage des codes `1916 / 2771 / 2772 …`


