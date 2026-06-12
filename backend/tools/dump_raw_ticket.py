from clients.glpi_client import GLPIClient
from core.config import Settings
import json

s = Settings()
client = GLPIClient(s)
# change ticket id if needed
TID = 26
raw = client.get_one('Ticket', TID)
with open(f'/app/raw_ticket_{TID}.json', 'w', encoding='utf-8') as f:
    json.dump(raw, f, ensure_ascii=False, indent=2)
print('WROTE', f'/app/raw_ticket_{TID}.json')
