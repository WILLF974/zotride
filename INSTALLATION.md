# Zot Ride – Guide d'installation et déploiement Hostinger

## Section A : Prérequis

- Hébergement Hostinger Business Cloud ou VPS avec Node.js
- Accès hPanel
- Node.js 20.x ou 22.x disponible sur l'hébergeur

---

## Section B : Test local (Mac/PC)

```bash
git clone ... (ou décompresser l'archive zotride-hostinger.zip)
cd zotride
npm install
npm run dev   # utilise node --experimental-sqlite (Mac)
```

**Note importante :**
- Sur **Mac**, `better-sqlite3` ne compile pas sans Xcode. L'application bascule automatiquement sur `node:sqlite` (Node.js 22+ requis).
- Sur **Linux** (Hostinger), `npm start` utilise `better-sqlite3` directement (compilation automatique).

---

## Section C : Déploiement Hostinger – étapes détaillées

### 1. Upload des fichiers via SFTP ou Gestionnaire de fichiers

- Uploader TOUT le contenu du dossier `zotride-hostinger.zip` dans le répertoire racine de votre domaine
- **NE PAS uploader** `node_modules/` (sera généré par Hostinger)
- Créer le dossier `data/` avec les droits d'écriture :
  ```bash
  mkdir data
  chmod 755 data
  ```

### 2. Configuration hPanel → Node.js

- Aller dans **hPanel > Sites Web > zotride.fr > Node.js**
- Version Node.js : **20.x** ou **22.x**
- Application root : `/home/user/domains/zotride.fr/`
- Application startup file : `server.js`
- Application URL : `zotride.fr`

### 3. Variables d'environnement dans hPanel

Dans hPanel > Node.js > Environment Variables, ajouter :

| Variable    | Valeur                            |
|-------------|-----------------------------------|
| PORT        | (laisser vide, Hostinger le gère) |
| JWT_SECRET  | votre-cle-secrete-generee         |
| NODE_ENV    | production                        |

Générer un JWT_SECRET sécurisé :
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4. Installation des dépendances

- Dans hPanel Node.js → cliquer **"Install NPM"**
- Attendre la fin de l'installation
- `better-sqlite3` se compile automatiquement sur Linux (Hostinger)

### 5. Démarrage de l'application

- Cliquer **"Start"** dans hPanel Node.js
- Vérifier dans **Logs** que la ligne `Zot Ride démarré` apparaît

### 6. Certificat SSL

- Aller dans **hPanel > SSL > Installer Let's Encrypt** pour `zotride.fr`
- Activer la redirection HTTP → HTTPS

### 7. Première connexion admin

- URL : `https://zotride.fr`
- Email : `admin@zotride.fr`
- Mot de passe : `admin123`
- **CHANGER LE MOT DE PASSE IMMÉDIATEMENT** après la première connexion

---

## Section D : Maintenance

| Action           | Procédure                              |
|------------------|----------------------------------------|
| Redémarrer       | hPanel > Node.js > **Restart**         |
| Voir les logs    | hPanel > Node.js > **Logs**            |
| Mise à jour      | Uploader les nouveaux fichiers > Restart |

---

## Section E : Dépannage

| Symptôme                    | Cause probable                          | Solution                                   |
|-----------------------------|-----------------------------------------|--------------------------------------------|
| Erreur 502 Bad Gateway      | Application pas démarrée               | Cliquer **Start** dans hPanel Node.js      |
| Erreur d'accès à la base DB | Droits insuffisants sur le dossier data | `chmod 755 data/` via SFTP                 |
| better-sqlite3 échoue       | Version Node.js trop ancienne           | Utiliser Node.js 20+ dans hPanel           |
| Module not found            | node_modules absent                     | Relancer **Install NPM** dans hPanel       |
| JWT invalid                 | JWT_SECRET non configuré               | Ajouter la variable d'environnement        |
