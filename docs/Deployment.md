## RPS Arena Deployment Guide

This document explains how to run the app locally and deploy it to Render with separate services for the Next.js frontend and the Socket.IO backend.

> The goal is to keep everything simple, reproducible, and easy to debug.

---

## 1. Local setup

### 1.1 Install dependencies

From the project root:

```bash
npm install
```

This installs both frontend and backend dependencies (Next.js, Socket.IO, Express, etc.).

### 1.2 Environment variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SOCKET_IO_URL=http://localhost:4000
```

This tells the frontend where to find the Socket.IO backend in local development.

### 1.3 Run the backend (Socket.IO server)

From the project root:

```bash
npm run server
```

- The backend listens on `http://localhost:4000` by default.
- You can quickly confirm it is running by visiting that URL in a browser.  
  You should see: `RPS Arena Socket.IO server is running`.

### 1.4 Run the frontend (Next.js app)

In a separate terminal, from the same project root:

```bash
npm run dev
```

Then open `http://localhost:3000` in a browser.

### 1.5 Local 2‑player test

1. Open two browser windows or profiles at `http://localhost:3000`.
2. In each window, enter a different player name.
3. In window A, create a room from the lobby.
4. In window B, join that room.
5. Play several rounds:
   - Both players pick Rock / Paper / Scissors.
   - After both moves, health bars and messages should update on both screens.
6. When the game ends:
   - Try both players choosing **YES** on the play‑again screen (rematch should start).
   - Try one **YES** and one **NO** (both should return to the lobby).

If this works, you are ready to deploy to Render.

---

## 2. Render deployment overview

Render will host two separate web services:

- **Backend service**: Node + Socket.IO server (`server/index.ts`).
- **Frontend service**: Next.js app (`src/app`).

The frontend talks to the backend through `NEXT_PUBLIC_SOCKET_IO_URL`.

---

## 3. Deploy the Socket.IO backend on Render

### 3.1 Create the backend service

1. Push your code to a Git repository (GitHub, GitLab, etc.).
2. In the Render dashboard, click **New → Web Service**.
3. Connect the repo that contains this project.
4. Select the branch you want to deploy (usually `main`).

### 3.2 Service settings

- **Name**: e.g. `rpsarena-backend`.
- **Environment**: `Node`.
- **Root directory**: project root (where `package.json` and `server/` live).
- **Build command**:

  ```bash
  npm install
  ```

- **Start command**:

  ```bash
  npm run server
  ```

- Leave the port configuration to Render:
  - Render sets `PORT` automatically.
  - The server reads `process.env.PORT` and falls back to `4000` for local dev.

Click **Create Web Service** and wait for the deploy to finish.

### 3.3 Verify backend deployment

After deployment:

1. Render will show a URL such as:

   ```text
   https://rpsarena-backend.onrender.com
   ```

2. Visit the URL in your browser.
   - You should see: `RPS Arena Socket.IO server is running`.

Keep this URL; you will need it for the frontend environment variable.

---

## 4. Deploy the Next.js frontend on Render

### 4.1 Create the frontend service

1. In Render, click **New → Web Service** again.
2. Use the same repo and branch as the backend.

### 4.2 Service settings

- **Name**: e.g. `rpsarena-frontend`.
- **Environment**: `Node`.
- **Root directory**: project root.
- **Build command**:

  ```bash
  npm install
  npm run build
  ```

- **Start command**:

  ```bash
  npm run start
  ```

### 4.3 Frontend environment variable

In the frontend service settings:

1. Go to **Environment → Environment Variables**.
2. Add:

   ```bash
   NEXT_PUBLIC_SOCKET_IO_URL=https://rpsarena-backend.onrender.com
   ```

   - Replace the URL with the actual backend URL from step 3.3.
   - Do **not** include a trailing slash.

3. Save the environment variables and trigger a redeploy of the frontend service.

After the deploy succeeds, Render will give you a frontend URL such as:

```text
https://rpsarena-frontend.onrender.com
```

---

## 5. End‑to‑end test on Render

1. Open the frontend URL in two different browsers or devices.
2. In each:
   - Enter a different player name.
3. In one browser:
   - Create a new room.
4. In the second browser:
   - Join the same room from the lobby list.
5. Play through a full match and then test the play‑again flow.

Everything should behave the same way as in local development, just with higher latency due to the internet.

---

## 6. Troubleshooting checklist

If something is not working in the deployed setup, check the following:

- **Socket connection fails**
  - Open the browser DevTools console and look for WebSocket or CORS errors.
  - Confirm `NEXT_PUBLIC_SOCKET_IO_URL` matches the backend URL exactly (scheme `https`, no trailing slash).
- **Backend not reachable**
  - Open the backend URL directly in the browser: you should see the health message.
  - Check the backend service logs in Render for startup or runtime errors.
- **Frontend uses old env value**
  - After changing `NEXT_PUBLIC_SOCKET_IO_URL`, make sure you **redeploy** the frontend service.
- **Lobby not updating**
  - Confirm the backend logs show `listRooms`, `createRoom`, and `joinRoom` events.
  - Make sure both services are running on the same branch / latest commit.

Once all of the above checks pass, your Render deployment should be stable for 2‑player realtime matches.

