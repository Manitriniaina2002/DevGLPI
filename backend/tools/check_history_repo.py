from repositories.ticket_repository import TicketRepository
from core.config import Settings
from clients.glpi_client import GLPIClient
import json

s=Settings()
c=GLPIClient(s)
repo=TicketRepository(s,c)
res = repo.get_ticket_history(26)
with open('/app/ticket_26_history_repo.json','w',encoding='utf-8') as f:
    json.dump(res, f, ensure_ascii=False, indent=2)
print('WROTE /app/ticket_26_history_repo.json')
