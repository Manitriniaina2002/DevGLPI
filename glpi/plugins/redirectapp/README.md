# Redirect App GLPI Plugin

Ce plugin ajoute un bouton fixe dans l\'interface GLPI pour rediriger vers une application externe.

## Installation
1. Copier le dossier `redirectapp` dans `<glpi_root>/plugins`
2. Activer le plugin depuis `Configuration > Plugins`
3. Le bouton `Ouvrir l'application` apparaîtra sur les pages GLPI

## Configuration
- Le bouton redirige actuellement vers `http://localhost:3000/`
- Vous pouvez modifier cette URL dans `js/redirectapp.js`
