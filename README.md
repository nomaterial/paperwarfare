# Paper Warfare

Multijoueur léger dans le navigateur : avions en papier, vol arcade, missiles, salon WebSocket.

## Démarrage

```bash
npm install
npm start
```

Ouvre l’URL affichée dans le terminal (souvent `http://localhost:8080/index.html`, ou `8082` si les ports précédents sont pris). Le client WebSocket utilise le **même hôte et port** que la page (compatible tunnels HTTPS type Cloudflare).

### Accès Internet rapide (Cloudflare)

Lance le jeu en local (`npm start`), note le port (ex. **8082**), puis dans un autre terminal :

```bash
npx --yes cloudflared tunnel --url http://localhost:8082
```

Remplace `8082` par le port réel du serveur Node. Ouvre **uniquement** l’URL `https://….trycloudflare.com` affichée par cloudflared : la même machine sert la page et le WebSocket (`wss://` sur le même hôte, sans `:8082` dans l’URL publique).

## Contenu

- `index.html` — scène A-Frame, lobby pseudo, synchro, combat
- `server.js` — fichiers statiques + relais WebSocket
- Assets : `paper_plane.glb`, `city_mapnot_a_scan.glb`, sons `.mp3`

## Développement

Structure volontairement simple pour itérer : logique réseau côté `server.js`, jeu côté `index.html` (composants `plane-board`, `flight-controls`, `combat-missile`, `window.MP`).

## Licence

Le dépôt peut contenir une licence à la racine (ex. Apache-2.0).
