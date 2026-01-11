# Event scheduler

A simple group scheduling application.

## Prerequisites
- Node.js (v18+)
- npm

## Setup

1. Install dependencies:

```bash
cd server && npm install
cd ../client && npm install
```

## Running the App

You need to run both the backend server and the frontend client.

**Terminal 1 (Backend):**
```bash
cd server
node index.js
```
Server runs on http://localhost:3000

**Terminal 2 (Frontend):**
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
