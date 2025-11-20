# WebM Composer Studio

<div align="center">
  <img src="public/favicon.svg" alt="HSH Logo" width="120" height="120">
</div>

Un éditeur vidéo dans le navigateur construit avec React et TypeScript. Créez des compositions vidéo professionnelles avec des playlists multi-clips, des superpositions vidéo, du mixage audio et des effets en temps réel - le tout fonctionnant entièrement dans votre navigateur.

## ✨ Fonctionnalités

- **Playlist Multi-Clips** : Ajoutez plusieurs fichiers vidéo à une piste principale avec des contrôles de découpage individuels
- **Superposition Vidéo** : Superposez une seconde vidéo avec positionnement et dimensionnement personnalisables
- **Mixage Audio** : Ajoutez des pistes audio externes avec contrôles de volume indépendants pour chaque source
- **Effets en Temps Réel** : Appliquez des filtres (niveaux de gris, sépia, flou, luminosité, etc.) et des zones de recadrage
- **Navigation Timeline** : Contrôle de lecture précis avec timeline visuelle
- **Export WebM** : Enregistrez et téléchargez votre composition finale au format WebM
- **Aucun Serveur Requis** : Tout fonctionne côté client en utilisant les API Web

## 🚀 Démarrage Rapide

**Prérequis :** Node.js (v16 ou supérieur)

1. **Cloner le dépôt**

   ```bash
   git clone https://github.com/JeanMarieProf/webmcomposer.git
   cd webmcomposer
   ```

2. **Installer les dépendances**

   ```bash
   npm install
   ```

3. **Lancer le serveur de développement**

   ```bash
   npm run dev
   ```

4. **Ouvrir votre navigateur**
   - Naviguez vers `http://localhost:3000`
   - Commencez à créer vos compositions vidéo !

## 🛠️ Stack Technique

- **React 19** - Framework UI
- **TypeScript** - Typage statique
- **Vite** - Outil de build et serveur de développement
- **Tailwind CSS** - Stylisation
- **HTML5 Canvas** - Rendu vidéo
- **Web Audio API** - Mixage audio
- **MediaRecorder API** - Export vidéo

## 📦 Build pour la Production

```bash
npm run build
```

Les fichiers prêts pour la production seront dans le dossier `dist/`.

## 🎯 Utilisation

1. **Ajouter des Vidéos** : Cliquez sur "Upload Main Video" pour ajouter des clips à votre playlist
2. **Découper les Clips** : Définissez les temps de début/fin pour chaque clip
3. **Ajouter une Superposition** : Téléchargez une seconde vidéo à superposer
4. **Mixer l'Audio** : Ajoutez des pistes audio externes et ajustez les volumes
5. **Appliquer des Effets** : Utilisez les filtres et outils de recadrage pour un contrôle créatif
6. **Exporter** : Cliquez sur "Start Recording" pour capturer votre composition

## 🔧 Configuration

Le projet utilise une configuration Vite optimisée pour le développement sous Windows. Le HMR (Hot Module Replacement) est configuré pour fonctionner correctement avec les connexions WebSocket sur localhost.

## 📝 Licence

Ce projet est open source et disponible sous la licence MIT.

## 🤝 Contribuer

Les contributions, issues et demandes de fonctionnalités sont les bienvenues !

## 👤 Auteur

**JeanMarieProf**

- GitHub: [@JeanMarieProf](https://github.com/JeanMarieProf)
