"""
clients/mock_client.py — Données simulées pour le développement
Génère 120 tickets réalistes sans avoir besoin de GLPI.
"""
from __future__ import annotations

import random
from datetime import date, timedelta


def generate_mock_tickets() -> list[dict]:
    rng = random.Random(42)

    acheteurs = [
        (10, "RANDRIANIRINA Isabelle"),
        (11, "ANDRIANASOLO Ny Ando"),
        (12, "RAJAONARISON Heriniaina"),
        (13, "RAHARINIRINA Claire"),
        (14, "ANDRIANASOLO Ny Ando"),
    ]
    projets = [
        (1, "M001 -- DN & Administration"),
        (2, "M004 -- Informatique (IT)"),
        (3, "M232 -- Programme École"),
        (4, "M300 -- Reboisement"),
        (0, "Sans projet"),
    ]
    keywords = ["Achat ", "Commande ", "Approvisionnement ", "Fourniture "]
    items = [
        "PC portable", "Écran", "Clavier", "Souris", "Imprimante",
        "Câbles réseau", "Serveur NAS", "Switch 24 ports", "UPS",
        "Bureau", "Chaise ergonomique", "Carburant", "Matériel reboisement",
    ]

    tickets = []
    base_date = date(2025, 1, 1)

    for i in range(1, 121):
        created = base_date + timedelta(days=rng.randint(0, 540))
        uid, uname = rng.choice(acheteurs)
        pid, pname = rng.choice(projets)
        status = rng.choices([1, 2, 3, 4, 5, 6], weights=[5, 15, 10, 8, 45, 17])[0]
        priority = rng.choices([1, 2, 3, 4, 5, 6], weights=[5, 20, 35, 25, 10, 5])[0]

        closedate = None
        if status in {5, 6}:
            closedate = created + timedelta(days=rng.randint(1, 30))

        ttr = created + timedelta(days=15)

        tickets.append({
            "id": i,
            "name": rng.choice(keywords) + rng.choice(items) + f" #{i:03d}",
            "status": status,
            "priority": priority,
            "date": str(created) + " 08:00:00",
            "closedate": str(closedate) + " 17:00:00" if closedate else None,
            "solvedate": str(closedate) + " 16:00:00" if closedate else None,
            "time_to_resolve": str(ttr) + " 17:00:00",
            "itilcategories_id": 1,
            "users_id_assign": uid,
            "users_id_requester": uid,
            "projects_id": pid,
            "_project_name": pname,
            "_buyer_name": uname,
        })

    return tickets