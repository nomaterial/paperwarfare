# Paper Warfare

Multijoueur léger dans le navigateur : avions en papier, vol arcade, missiles, salon WebSocket.

## Démarrage

```bash
npm install
npm start
```

Ouvre l’URL affichée dans le terminal (souvent `http://localhost:8080/index.html`). Le client WebSocket utilise le **même hôte et port** que la page (compatible tunnels HTTPS type Cloudflare).

## Contenu

- `index.html` — scène A-Frame, lobby pseudo, synchro, combat
- `server.js` — fichiers statiques + relais WebSocket
- Assets : `paper_plane.glb`, `city_mapnot_a_scan.glb`, sons `.mp3`

## Développement

Structure volontairement simple pour itérer : logique réseau côté `server.js`, jeu côté `index.html` (composants `plane-board`, `flight-controls`, `combat-missile`, `window.MP`).

## Licence

Le dépôt peut contenir une licence à la racine (ex. Apache-2.0).
