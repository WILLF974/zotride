# Zot Ride – Guide d'installation Hostinger (Astro + Node.js)

## Prérequis
- Hébergement Hostinger **Node.js** (hPanel)
- Node.js ≥ 20
- Accès SSH ou File Manager

---

## Structure du déploiement

Après le build, `dist/` contient :
```
dist/
  server/entry.mjs   ← point d'entrée du serveur Node.js
  client/            ← assets statiques (CSS, JS)
```

La commande de démarrage : `node dist/server/entry.mjs`

---

## Étapes de déploiement sur Hostinger

### 1. Uploader l'archive
- Ouvrir **hPanel → File Manager**
- Naviguer vers `/home/user/domains/zotride.fr/`
- Uploader `zotride-hostinger.zip`
- Clic droit → **Extraire** dans le dossier courant

### 2. Installer les dépendances natives
Via le **terminal SSH** ou **hPanel Terminal** :
```bash
cd /home/user/domains/zotride.fr
npm install
```
> Cela installe uniquement `better-sqlite3` (optionnel, compilé sur Linux).

### 3. Configurer les variables d'environnement
```bash
cp .env.example .env
nano .env
```
Renseigner :
```
PORT=3000
JWT_SECRET=une-valeur-secrete-longue-et-aleatoire
NODE_ENV=production
```

### 4. Configurer Node.js dans hPanel
- **hPanel → Node.js**
- **Application root** : `/home/user/domains/zotride.fr`
- **Application startup file** : `dist/server/entry.mjs`
- **Node.js version** : 20 ou supérieure
- Cliquer **Save** puis **Restart**

### 5. Vérifier le démarrage
```bash
# Tester manuellement
node dist/server/entry.mjs

# Vérifier l'API
curl http://localhost:3000/api/health
# → {"status":"ok","app":"Zot Ride"}
```

---

## Identifiants admin par défaut

| Email | Mot de passe |
|-------|-------------|
| admin@zotride.fr | admin123 |

**⚠️ Changer le mot de passe admin dès la première connexion.**

---

## Développement local (Mac)

```bash
# Installer les dépendances
npm install

# Lancer en mode développement (Node 24 avec SQLite intégré)
npm run dev

# Ou builder et tester le build
npm run build:mac
node --experimental-sqlite dist/server/entry.mjs
```

---

## Maintenance

### Sauvegarde base de données
```bash
cp data/zotride.db data/zotride.db.backup
```

### Mise à jour du code
1. Modifier le code source sur votre machine
2. Exécuter `npm run build`
3. Uploader le nouveau `dist/` + créer un nouveau zip
4. Remplacer sur Hostinger et redémarrer Node.js

### Redémarrer l'application
Via **hPanel → Node.js → Restart**

---

## Dépannage

| Problème | Solution |
|---------|---------|
| `better-sqlite3` ne compile pas | Vérifier la version Node.js (≥ 20), les build tools Linux |
| Port déjà utilisé | Vérifier `PORT` dans `.env` |
| Base de données corrompue | Restaurer depuis la sauvegarde |
| Token JWT invalide | Vérifier que `JWT_SECRET` est identique après redémarrage |
