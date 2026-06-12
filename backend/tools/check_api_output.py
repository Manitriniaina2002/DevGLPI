from repositories.ticket_repository import TicketRepository
from services.ticket_service import TicketService
from core.config import Settings
from clients.glpi_client import GLPIClient
import json

s=Settings()
c=GLPIClient(s)
repo=TicketRepository(s,c)
svc=TicketService(s)

tickets = repo.get_purchase_tickets()
print('first ticket has _buyer_name:', tickets[0].get('_buyer_name'))
print('first ticket raw snippet keys:', list(tickets[0].keys())[:40])
print('first ticket users_id_recipient:', tickets[0].get('users_id_recipient'))
res = svc.filter_and_paginate(tickets, limit=10, offset=0)
with open('/app/api_output.json','w',encoding='utf-8') as f:
    json.dump(res, f, ensure_ascii=False, indent=2)
print('WROTE /app/api_output.json')
