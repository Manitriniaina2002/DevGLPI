from repositories.ticket_repository import TicketRepository
from core.config import Settings
from clients.glpi_client import GLPIClient
import json

s=Settings()
c=GLPIClient(s)
repo=TicketRepository(s,c)
raw=c.get_one('Ticket',26)
print('raw users_id_recipient=', raw.get('users_id_recipient'))
print('raw keys=', list(raw.keys()))
users = repo.get_users()
print('users count=', len(users))
print('users sample keys:', list(users.keys())[:10])
enriched = repo._enrich([raw])[0]
print('enriched _buyer_name=', enriched.get('_buyer_name'))
with open('/app/debug_enrich_26.json','w',encoding='utf-8') as f:
    json.dump({'raw':raw,'enriched':enriched,'users_keys':list(users.keys())}, f, ensure_ascii=False, indent=2)
print('WROTE /app/debug_enrich_26.json')
