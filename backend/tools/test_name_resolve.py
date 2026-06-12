from repositories.ticket_repository import TicketRepository
from core.config import Settings
from clients.glpi_client import GLPIClient
s=Settings();c=GLPIClient(s);repo=TicketRepository(s,c)
users=repo.get_users()
print('users sample:', list(users.items())[:10])
name_to_uid = {v.lower(): k for k, v in users.items() if isinstance(v, str)}
print('manitra ->', name_to_uid.get('manitra'))
print('full map lookup for Manitra:', name_to_uid.get('manitra'))
