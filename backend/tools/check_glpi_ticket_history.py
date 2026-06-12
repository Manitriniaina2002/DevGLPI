from clients.glpi_client import GLPIClient
from core.config import Settings
import json

s = Settings()
c = GLPIClient(s)
TID = 26
followups = c.get_ticket_followups(TID)
changes = c.get_ticket_changes(TID)
print('followups count=', len(followups))
print('changes count=', len(changes))
with open(f'/app/glpi_ticket_{TID}_followups.json','w',encoding='utf-8') as f:
    json.dump(followups, f, ensure_ascii=False, indent=2)
with open(f'/app/glpi_ticket_{TID}_changes.json','w',encoding='utf-8') as f:
    json.dump(changes, f, ensure_ascii=False, indent=2)
print('WROTE files')
