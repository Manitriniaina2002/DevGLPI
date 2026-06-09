"""
services/form_parser.py — Parseur du contenu HTML généré par GLPI Forms
========================================================================
Le formulaire "DEMANDE D'ACHAT" génère automatiquement le contenu du ticket
avec toutes les réponses. Ce module extrait les valeurs depuis ce contenu.

Structure typique du content GLPI Forms (HTML auto-généré) :
  <p><strong>Projet</strong> : M004 -- Informatique (IT)</p>
  <p><strong>A valider par</strong> : Groupe Finance</p>
  <p><strong>Objet</strong> : Achat PC portable</p>
  <p><strong>Description détaillée du besoin</strong> : ...</p>
  <p><strong>Bénéficiaire de l'achat</strong> : Dupont Jean</p>
  <p><strong>Lieu de livraison souhaité</strong> : DN MAHAMASINA</p>
  <p><strong>Date de livraison souhaitée</strong> : 2026-07-01</p>

Mapping urgence texte → int GLPI :
  Très basse → 1, Basse → 2, Moyenne → 3, Haute → 4, Très haute → 5
"""
from __future__ import annotations

import re
import html
from typing import Optional


# ── Mapping urgence label → int GLPI ─────────────────────────────
URGENCE_MAP: dict[str, int] = {
    "très basse": 1,
    "tres basse": 1,
    "basse":      2,
    "moyenne":    3,
    "haute":      4,
    "très haute": 5,
    "tres haute": 5,
}

# ── Mapping projet label → nom court ─────────────────────────────
# Extrait le code projet depuis "M004  --  Informatique (IT)" → "M004 -- Informatique (IT)"
def _normalize_projet(raw: str) -> str:
    return re.sub(r"\s{2,}", " ", raw.strip())


def _strip_html(text: str) -> str:
    """Supprime les balises HTML et décode les entités."""
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_field(content: str, label: str) -> Optional[str]:
    """
    Extrait la valeur d'un champ depuis le contenu HTML GLPI Forms.
    Cherche : <strong>label</strong> : valeur
    ou        label : valeur  (texte brut)
    """
    if not content:
        return None

    # Pattern HTML : <strong>Projet</strong> : M004...
    pattern_html = rf"<strong>\s*{re.escape(label)}\s*</strong>\s*:?\s*([^<\n]+)"
    m = re.search(pattern_html, content, re.IGNORECASE)
    if m:
        return _strip_html(m.group(1)).strip(" :")

    # Pattern texte brut : Projet : M004...
    pattern_text = rf"{re.escape(label)}\s*:\s*([^\n<]+)"
    m = re.search(pattern_text, content, re.IGNORECASE)
    if m:
        return _strip_html(m.group(1)).strip()

    return None


class FormParser:
    """
    Extrait les champs du formulaire GLPI depuis le contenu HTML d'un ticket.
    
    Usage :
        parser = FormParser()
        result = parser.parse(ticket["content"])
        ticket["_project_name"] = result.projet or "Sans projet"
        ticket["_service"]      = result.service or "Non renseigné"
        ticket["_urgence_int"]  = result.urgence_int or ticket.get("urgency", 3)
    """

    def parse(self, content: str) -> "ParsedForm":
        if not content:
            return ParsedForm()

        projet  = _extract_field(content, "Projet")
        service = _extract_field(content, "Service demandeur")
        lieu    = _extract_field(content, "Lieu de livraison souhait")
        date_l  = _extract_field(content, "Date de livraison souhait")
        benef   = _extract_field(content, "Bénéficiaire de l'achat") or \
                  _extract_field(content, "Beneficiaire de l'achat")
        desc    = _extract_field(content, "Description détaillée du besoin") or \
                  _extract_field(content, "Description detaillee du besoin")
        valider = _extract_field(content, "A valider par")

        # Urgence : champ futur si ajouté au formulaire
        urgence_raw = _extract_field(content, "Urgence")
        urgence_int = None
        if urgence_raw:
            urgence_int = URGENCE_MAP.get(urgence_raw.lower().strip())

        return ParsedForm(
            projet      = _normalize_projet(projet) if projet else None,
            service     = service,
            lieu        = lieu,
            date_livr   = date_l,
            beneficiaire= benef,
            description = desc,
            a_valider   = valider,
            urgence_raw = urgence_raw,
            urgence_int = urgence_int,
        )


class ParsedForm:
    def __init__(
        self,
        projet:       Optional[str] = None,
        service:      Optional[str] = None,
        lieu:         Optional[str] = None,
        date_livr:    Optional[str] = None,
        beneficiaire: Optional[str] = None,
        description:  Optional[str] = None,
        a_valider:    Optional[str] = None,
        urgence_raw:  Optional[str] = None,
        urgence_int:  Optional[int] = None,
    ):
        self.projet       = projet
        self.service      = service
        self.lieu         = lieu
        self.date_livr    = date_livr
        self.beneficiaire = beneficiaire
        self.description  = description
        self.a_valider    = a_valider
        self.urgence_raw  = urgence_raw
        self.urgence_int  = urgence_int

    def __repr__(self):
        return (
            f"ParsedForm(projet={self.projet!r}, service={self.service!r}, "
            f"urgence={self.urgence_raw!r}({self.urgence_int}), "
            f"lieu={self.lieu!r}, benef={self.beneficiaire!r})"
        )
