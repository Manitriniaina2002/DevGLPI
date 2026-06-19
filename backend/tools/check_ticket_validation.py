import os
import sys

# Assure que Python voit le dossier /app/backend dans le conteneur
# (car l'exécution se fait souvent depuis /app).
# Dans le conteneur, les modules (clients/, core/, ...) sont directement sous /app.
# Donc on ajoute /app au PYTHONPATH.
APP_DIR = '/app'
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)



from clients.glpi_client import GLPIClient
from core.config import Settings
import json


s = Settings()
c = GLPIClient(s)

# Choisir un ticket qui a réellement été validé / refusé dans GLPI
TID = 28  # <-- remplace par un ticket validé si besoin

raw = c.get_one('Ticket', TID)
print('global_validation sur le ticket =', raw.get('global_validation'))

validations = c.get_ticket_validations(TID)
print('nb validations =', len(validations))

out_path = f'/app/ticket_{TID}_validations.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(validations, f, ensure_ascii=False, indent=2)

print('WROTE', out_path)

