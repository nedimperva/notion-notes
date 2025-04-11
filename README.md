# Thought Base

A Progressive Web App (PWA) for note-taking with Notion integration, designed to work both online and offline.

## Features

- 📝 Note-taking with rich text support
- 🔄 Real-time synchronization with Notion
- 📱 Progressive Web App (PWA) support
- 🌐 Works offline
- 📱 Installable on mobile devices
- 🔄 Automatic updates
- 🔒 Secure Notion OAuth integration

## PWA Features

- Offline functionality
- Installable on mobile devices
- Standalone mode support
- Automatic updates
- Cached API responses
- Service worker for offline access

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Notion account
- Notion integration (for OAuth)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/thought-base.git
cd thought-base
```

2. Install dependencies:
```bash
npm install
cd backend
npm install
cd ..
```

3. Set up environment variables:
   - Create `.env` file in the root directory:
   ```
   VITE_NOTION_CLIENT_ID=your_notion_client_id
   VITE_NOTION_REDIRECT_URI=http://localhost:5173/auth/callback
   ```
   - Create `.env` file in the backend directory:
   ```
   PORT=3001
   NOTION_CLIENT_ID=your_notion_client_id
   NOTION_CLIENT_SECRET=your_notion_client_secret
   REDIRECT_URI=http://localhost:5173/auth/callback
   ```

4. Start the development servers:
   - Terminal 1 (Backend):
   ```bash
   cd backend
   npm run dev
   ```
   - Terminal 2 (Frontend):
   ```bash
   npm run dev
   ```

5. Access the application:
   - Open `http://localhost:5173` in your browser
   - For mobile access, use your computer's local IP address (e.g., `http://192.168.1.100:5173`)

## Installing as PWA

1. Open the app in Chrome or Edge
2. Click the install button in the address bar
3. Follow the prompts to install the app
4. The app will now be available in your applications list

## Offline Usage

- The app caches your notes and Notion data
- Works without internet connection
- Syncs changes when back online
- Automatic background sync

## Development

- Frontend: React + Vite
- Backend: Node.js + Express
- PWA: Service Worker + Cache API
- Styling: Tailwind CSS

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
