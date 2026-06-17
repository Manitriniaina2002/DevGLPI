from services.metrics_service import _ticket_project_name
from repositories.ticket_repository import _resolve_project_id


import pytest


@pytest.mark.parametrize(
    "ticket,expected",
    [
        ({"projects_id": 5}, 5),
        ({"project_id": "7"}, 7),
        ({"project": {"id": 8}}, 8),
        ({"project": {"projects_id": "9"}}, 9),
        ({"projects": "10"}, 10),
        ({"projects": [11]}, 11),
        ({"project": {"name": "M004 -- Informatique (IT)"}}, 0),
        ({}, 0),
    ],
)
def test_resolve_project_id(ticket, expected):
    assert _resolve_project_id(ticket) == expected


@pytest.mark.parametrize(
    "ticket,expected",
    [
        ({"_project_name": "M001 -- DN & Administration"}, "M001 -- DN & Administration"),
        ({"projet": "M004 -- Informatique (IT)"}, "M004 -- Informatique (IT)"),
        ({"project": {"name": "M232 -- Programme École"}}, "M232 -- Programme École"),
        ({"project": {"id": 4}}, "Projet #4"),
        ({"projects": "17"}, "Projet #17"),
        ({}, "Sans projet"),
    ],
)
def test_ticket_project_name(ticket, expected):
    assert _ticket_project_name(ticket) == expected


def test_invalid_project_value_returns_default():
    assert _resolve_project_id({"project": ["abc"]}) == 0
