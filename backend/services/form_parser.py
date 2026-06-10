"""
services/form_parser.py — Parseur du contenu HTML généré par GLPI Forms
========================================================================
Le formulaire "DEMANDE D'ACHAT" génère automatiquement le contenu du ticket.

Format réel GLPI Forms (balise <b> avec préfixe numéroté) :
  <b>1) Projet</b>: M001  --  DN & Administration
  <b>2) A valider par</b>: ANDRIANAIVONAMBININA Abel
  <b>3) Objet</b>: Achat PC portable
  <b>5) Description détaillée du besoin</b>: ...
  <b>6) Bénéficiaire de l'achat</b>: RAZAFINDRAVONY Annitah
  <b>7) Lieu de livraison souhaité (optionnel)</b>: DN MAHAMASINA
  <b>8) Date de livraison souhaité (optionnel)</b>: 2026-06-29
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


def _normalize_projet(raw: str) -> str:
    """Normalise les espaces multiples : 'M001  --  DN' → 'M001 -- DN'"""
    return re.sub(r"\s{2,}", " ", raw.strip())


def _strip_html(text: str) -> str:
    """Supprime les balises HTML et décode les entités."""
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_field(content: str, label: str) -> Optional[str]:
    """
    Extrait la valeur d'un champ depuis le contenu HTML GLPI Forms.

    Supporte les formats :
      <b>N) Label</b>: valeur          ← format réel GLPI Forms
      <b>Label</b>: valeur             ← variante sans numéro
      <strong>Label</strong> : valeur  ← ancien format
      Label : valeur                   ← texte brut
    """
    if not content:
        return None

    escaped = re.escape(label)

    # Format réel GLPI Forms : <b>N) Projet</b>: valeur
    # Le label peut contenir des caractères accentués encodés (é→??)
    # On cherche avec le numéro optionnel et un match insensible à la casse
    pattern_b_numbered = rf"<b>\s*\d+\)\s*{escaped}[^<]*</b>\s*:?\s*([^<\n]+)"
    m = re.search(pattern_b_numbered, content, re.IGNORECASE)
    if m:
        return _strip_html(m.group(1)).strip(" :")

    # Format <b> sans numéro
    pattern_b = rf"<b>\s*{escaped}[^<]*</b>\s*:?\s*([^<\n]+)"
    m = re.search(pattern_b, content, re.IGNORECASE)
    if m:
        return _strip_html(m.group(1)).strip(" :")

    # Format <strong> (ancien)
    pattern_strong = rf"<strong>\s*{escaped}[^<]*</strong>\s*:?\s*([^<\n]+)"
    m = re.search(pattern_strong, content, re.IGNORECASE)
    if m:
        return _strip_html(m.group(1)).strip(" :")

    # Texte brut
    pattern_text = rf"{escaped}\s*:\s*([^\n<]+)"
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
        ticket["_beneficiaire"] = result.beneficiaire or ""
    """

    def parse(self, content: str) -> "ParsedForm":
        if not content:
            return ParsedForm()

        projet  = _extract_field(content, "Projet")
        lieu    = (
            _extract_field(content, "Lieu de livraison souhait")
            or _extract_field(content, "Lieu de livraison")
        )
        date_l  = (
            _extract_field(content, "Date de livraison souhait")
            or _extract_field(content, "Date de livraison")
        )
        benef   = (
            _extract_field(content, "B")  # Bénéficiaire encodé parfois en B??n??ficiaire
            or _extract_field(content, "Beneficiaire de l'achat")
            or _extract_field(content, "Bénéficiaire de l'achat")
        )
        # Chercher bénéficiaire par position (champ 6)
        if not benef:
            m = re.search(r"<b>\s*6\)[^<]*</b>\s*:?\s*([^<\n]+)", content, re.IGNORECASE)
            if m:
                benef = _strip_html(m.group(1)).strip(" :")

        desc    = _extract_description(content)
        valider = _extract_field(content, "A valider par")
        service = _extract_field(content, "Service demandeur")

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
            f"ParsedForm(projet={self.projet!r}, a_valider={self.a_valider!r}, "
            f"lieu={self.lieu!r}, benef={self.beneficiaire!r}, "
            f"urgence={self.urgence_raw!r}({self.urgence_int}))"
        )


def _extract_description(content: str) -> Optional[str]:
    """
    Extraction spéciale pour la description qui peut contenir des balises <p> imbriquées.
    Capture tout le contenu entre le champ description et le champ suivant.
    """
    pattern = r"<b>\s*\d+\)\s*[^<]*[Dd]escription[^<]*</b>\s*:?\s*(.*?)(?=<b>|$)"
    m = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
    if m:
        raw = m.group(1)
        clean = re.sub(r"<[^>]+>", " ", raw)
        clean = html.unescape(clean)
        clean = re.sub(r"\s+", " ", clean).strip(" :")
        return clean if clean else None
    return None