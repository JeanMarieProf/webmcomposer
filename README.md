# WebM Composer Studio

A browser-based video editor built with React and TypeScript. Create professional video compositions with multi-clip playlists, video overlays, audio mixing, and real-time effects - all running entirely in your browser.

## ✨ Features

- **Multi-Clip Playlist**: Add multiple video files to a main track with individual trimming controls
- **Video Overlay**: Layer a second video on top with customizable positioning and sizing
- **Audio Mixing**: Add external audio tracks with independent volume controls for each source
- **Real-Time Effects**: Apply filters (grayscale, sepia, blur, brightness, etc.) and crop areas
- **Timeline Scrubbing**: Precise playback control with visual timeline
- **WebM Export**: Record and download your final composition in WebM format
- **No Server Required**: Everything runs client-side using Web APIs

## 🚀 Quick Start

**Prerequisites:** Node.js (v16 or higher)

1. **Clone the repository**

   ```bash
   git clone https://github.com/JeanMarieProf/webmcomposer.git
   cd webmcomposer
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**
   - Navigate to `http://localhost:3000`
   - Start creating your video compositions!

## 🛠️ Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **HTML5 Canvas** - Video rendering
- **Web Audio API** - Audio mixing
- **MediaRecorder API** - Video export

## 📦 Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` folder.

## 🎯 Usage

1. **Add Videos**: Click "Upload Main Video" to add clips to your playlist
2. **Trim Clips**: Set start/end times for each clip
3. **Add Overlay**: Upload a second video to layer on top
4. **Mix Audio**: Add external audio tracks and adjust volumes
5. **Apply Effects**: Use filters and crop tools for creative control
6. **Export**: Click "Start Recording" to capture your composition

## 🔧 Configuration

The project uses a fixed Vite configuration optimized for Windows development. The HMR (Hot Module Replacement) is configured to work correctly with WebSocket connections on localhost.

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 👤 Author

**JeanMarieProf**

- GitHub: [@JeanMarieProf](https://github.com/JeanMarieProf)
