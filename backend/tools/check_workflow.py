"""
tools/check_workflow.py — Test du workflow en 5 étapes
========================================================
Vérifie que le service WorkflowService produit bien la structure
JSON attendue avec les 5 étapes : creation, validation, attribution,
solution, resolution.

Utilisation :
  docker exec -it glpi-backend-1 python /app/tools/check_workflow.py <ticket_id>

Si aucun ticket_id n'est fourni, teste avec le mock (ticket #1).
"""
from __future__ import annotations

import json
import sys
import os

# S'assurer que /app est dans le path
APP_DIR = '/app'
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

from core.config import Settings
from services.workflow_service import WorkflowService

# Test de la structure mock
def test_mock_workflow():
    """Teste le workflow avec un ticket mock (sans logs ni validations)."""
    s = Settings()
    svc = WorkflowService(s)

    # Simuler un ticket mock résolu
    ticket = {
        "id": 1,
        "name": "Test ticket",
        "status": 5,  # Résolu
        "date": "2025-06-01 08:00:00",
        "closedate": "2025-06-15 17:00:00",
        "solvedate": "2025-06-15 16:00:00",
        "users_id_assign": 10,
        "users_id_requester": 5,
        "_buyer_name": "RANDRIANIRINA Isabelle",
    }

    logs: list[dict] = []
    validations: list[dict] = []

    result = svc.build_workflow(ticket, logs, validations)

    print("=" * 60)
    print("TEST 1: Ticket mock résolu (sans logs, sans validations)")
    print("=" * 60)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print()

    # Vérifications structurelles
    assert "ticket_id" in result, "ticket_id manquant"
    assert "statut_global" in result, "statut_global manquant"
    assert "etapes" in result, "etapes manquant"
    assert len(result["etapes"]) == 5, f"5 étapes attendues, got {len(result['etapes'])}"

    etapes_names = [e["etape"] for e in result["etapes"]]
    assert etapes_names == ["creation", "validation", "attribution", "solution", "resolution"], \
        f"Ordre des étapes incorrect: {etapes_names}"

    # Vérifications individuelles
    creation = result["etapes"][0]
    assert creation["statut"] == "done", f"Création devrait être done: {creation['statut']}"
    assert creation["date"] is not None, "Date de création manquante"

    validation = result["etapes"][1]
    assert validation["statut"] == "unknown", \
        f"Validation sans données devrait être unknown: {validation['statut']}"

    attribution = result["etapes"][2]
    assert attribution["statut"] == "done", f"Attribution devrait être done: {attribution['statut']}"

    solution = result["etapes"][3]
    assert solution["statut"] == "pending", \
        f"Solution sans logs devrait être pending: {solution['statut']}"

    resolution = result["etapes"][4]
    assert resolution["statut"] == "done", f"Résolution devrait être done: {resolution['statut']}"

    print("✓ Test 1 PASSÉ: structure et statuts corrects")
    return result


def test_with_logs_and_solution():
    """Teste le workflow avec des logs simulés incluant une solution."""
    s = Settings()
    svc = WorkflowService(s)

    ticket = {
        "id": 42,
        "name": "Achat PC portable",
        "status": 5,  # Résolu
        "date": "2025-03-10 09:00:00",
        "closedate": "2025-03-25 14:00:00",
        "solvedate": "2025-03-25 13:00:00",
        "users_id_assign": 11,
        "users_id_requester": 3,
        "_buyer_name": "ANDRIANASOLO Ny Ando",
    }

    # Logs simulés (format enrichi par le repository)
    logs = [
        {
            "id": 1,
            "date": "2025-03-10 09:00:00",
            "author_name": "RAKOTO Jean",
            "content": "Création du ticket",
            "type": "followup",
            "raw": {
                "linked_action": 20,
                "user_name": "RAKOTO Jean",
            },
        },
        {
            "id": 2,
            "date": "2025-03-11 10:00:00",
            "author_name": "RANDRIANIRINA Isabelle",
            "content": "Ajout d'un lien avec un élément : ANDRIANASOLO Ny Ando",
            "type": "change",
            "mise_a_jour": "Ajout d'un lien avec un élément : ANDRIANASOLO Ny Ando",
            "raw": {
                "linked_action": 15,
                "itemtype_link": "User",
                "new_value": "ANDRIANASOLO Ny Ando",
                "user_name": "RANDRIANIRINA Isabelle",
                "date_mod": "2025-03-11 10:00:00",
            },
        },
        {
            "id": 3,
            "date": "2025-03-20 11:00:00",
            "author_name": "ANDRIANASOLO Ny Ando",
            "content": "Solution: PC livré et installé",
            "type": "followup",
            "raw": {
                "linked_action": 17,
                "itemtype_link": "ITILSolution",
                "new_value": "Solution apportée",
                "user_name": "ANDRIANASOLO Ny Ando",
                "date_mod": "2025-03-20 11:00:00",
            },
        },
    ]

    validations = [
        {
            "id": 1,
            "status": 2,  # ACCEPTED
            "submission_date": "2025-03-10 10:00:00",
            "validation_date": "2025-03-11 09:00:00",
            "users_id_validate": "RANDRIANIRINA Isabelle",
            "comment_validation": "Bon pour achat",
        },
    ]

    result = svc.build_workflow(ticket, logs, validations)

    print("=" * 60)
    print("TEST 2: Ticket avec logs complets + validation acceptée")
    print("=" * 60)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print()

    etapes = {e["etape"]: e for e in result["etapes"]}

    assert result["statut_global"] == "done", "devrait être done"

    # Création
    assert etapes["creation"]["statut"] == "done"
    assert etapes["creation"]["acteur"] == "RAKOTO Jean"

    # Validation
    assert etapes["validation"]["statut"] == "done"
    assert etapes["validation"]["date"] == "2025-03-11 09:00:00"
    assert etapes["validation"]["detail"] == "Bon pour achat"

    # Attribution
    assert etapes["attribution"]["statut"] == "done"
    assert etapes["attribution"]["acteur"] == "ANDRIANASOLO Ny Ando"

    # Solution
    assert etapes["solution"]["statut"] == "done"
    assert etapes["solution"]["date"] == "2025-03-20 11:00:00"
    assert etapes["solution"]["acteur"] == "ANDRIANASOLO Ny Ando"

    # Résolution
    assert etapes["resolution"]["statut"] == "done"
    assert etapes["resolution"]["date"] is not None

    print("✓ Test 2 PASSÉ: toutes les étapes done avec acteurs corrects")
    return result


def test_with_validation_refused():
    """Teste le workflow avec validation refusée."""
    s = Settings()
    svc = WorkflowService(s)

    ticket = {
        "id": 99,
        "name": "Achat refusé",
        "status": 1,  # Nouveau (jamais résolu)
        "date": "2025-04-01 08:00:00",
        "users_id_assign": 12,
        "users_id_requester": 3,
        "_buyer_name": "RAJAONARISON Heriniaina",
    }

    logs = []
    validations = [
        {
            "id": 2,
            "status": 3,  # REFUSED
            "submission_date": "2025-04-02 10:00:00",
            "validation_date": "2025-04-03 14:00:00",
            "users_id_validate": "CHEF Service",
            "comment_validation": "Budget insuffisant",
        },
    ]

    result = svc.build_workflow(ticket, logs, validations)

    print("=" * 60)
    print("TEST 3: Ticket avec validation refusée")
    print("=" * 60)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print()

    assert result["statut_global"] == "refused", \
        f"statut_global devrait être refused: {result['statut_global']}"

    validation = result["etapes"][1]
    assert validation["statut"] == "refused", \
        f"Validation devrait être refused: {validation['statut']}"
    assert validation["detail"] == "Budget insuffisant"

    resolution = result["etapes"][4]
    assert resolution["statut"] == "pending", \
        f"Résolution devrait être pending: {resolution['statut']}"

    print("✓ Test 3 PASSÉ: statut_global=refused, validation refusée avec commentaire")
    return result


def test_solution_text_fallback():
    """Teste la détection de solution via le texte du log (pas ITILSolution)."""
    s = Settings()
    svc = WorkflowService(s)

    ticket = {
        "id": 55,
        "name": "Achat avec solution textuelle",
        "status": 5,
        "date": "2025-05-01 08:00:00",
        "solvedate": "2025-05-10 16:00:00",
        "users_id_assign": 13,
        "_buyer_name": "RAHARINIRINA Claire",
    }

    # Log avec mention textuelle de "Solution" mais sans ITILSolution
    logs = [
        {
            "id": 10,
            "date": "2025-05-05 14:00:00",
            "author_name": "RAHARINIRINA Claire",
            "content": "Ajout de la solution : Matériel livré et conforme",
            "type": "change",
            "champ": "Solution",
            "mise_a_jour": "Matériel livré et conforme",
            "raw": {
                "linked_action": 17,
                "user_name": "RAHARINIRINA Claire",
                "date_mod": "2025-05-05 14:00:00",
            },
        },
    ]

    validations = []

    result = svc.build_workflow(ticket, logs, validations)

    print("=" * 60)
    print("TEST 4: Solution détectée par texte (fallback)")
    print("=" * 60)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print()

    solution = result["etapes"][3]
    assert solution["statut"] == "done", \
        f"Solution devrait être done: {solution['statut']}"
    assert solution["date"] == "2025-05-05 14:00:00"

    print("✓ Test 4 PASSÉ: solution détectée par fallback textuel")
    return result


if __name__ == "__main__":
    argv = sys.argv[1:]

    if argv and argv[0].isdigit():
        # Mode réel : utilise le client GLPI et le repo
        ticket_id = int(argv[0])
        print(f"Test avec le ticket réel #{ticket_id}...")
        from clients.glpi_client import GLPIClient
        from repositories.ticket_repository import TicketRepository

        s = Settings()
        if s.use_mock_data:
            print("⚠️  Le mode mock_data est actif. Les données réelles ne seront pas utilisées.")
            print("   Définissez USE_MOCK_DATA=false dans .env et redémarrez.")
            sys.exit(1)

        client = GLPIClient(s)
        repo = TicketRepository(s, client)
        svc = WorkflowService(s)

        # Récupérer le ticket
        raw = client.get_one("Ticket", ticket_id)
        # Récupérer les logs complets
        logs = repo.get_ticket_history(ticket_id)
        # Récupérer les validations
        validations = client.get_ticket_validations(ticket_id)

        print(f"Ticket: {raw.get('name')} (status={raw.get('status')})")
        print(f"Logs: {len(logs)} entrées")
        print(f"Validations: {len(validations)} entrées")
        print()

        result = svc.build_workflow(raw, logs, validations)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print()

        # Sauvegarder
        out = f"/app/workflow_ticket_{ticket_id}.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"Résultat sauvegardé dans {out}")

    else:
        print("Aucun ticket_id fourni → exécution des tests unitaires\n")
        test_mock_workflow()
        test_with_logs_and_solution()
        test_with_validation_refused()
        test_solution_text_fallback()
        print("\n" + "=" * 60)
        print("TOUS LES TESTS ONT RÉUSSI")
        print("=" * 60)
