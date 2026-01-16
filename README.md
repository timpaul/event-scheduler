# Event scheduler

A simple group scheduling application.

## Prerequisites
- Node.js (v18+)
- npm

## Quick Start

1. Install dependencies and build:
   ```bash
   npm run build
   ```

2. Start the application:
   ```bash
   npm start
   ```
   The app will typically run on http://localhost:3000

## Development Setup

If you want to run the backend and frontend separately for development:

1. Install dependencies:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. Run the Backend (Terminal 1):
   ```bash
   cd server
   node index.js
   ```
   Server runs on http://localhost:3000

3. Run the Frontend (Terminal 2):
   ```bash
   cd client
   npm run dev
   ```
   Client runs on http://localhost:5173

## Features
- Create events with varying durations.
- Share link with participants.
- Participants select availability.
- Heatmap visualization of best times.
