# ⚡ DEVCEPTION

<div align="center">

> **The Social Deception Coding E-Sport Built for Developers**  
> *Collaborate in a real-time CRDT code editor, solve algorithmic challenges, and unmask the Impostor before they sabotage the codebase!*

[![Next.js](https://img.shields.io/badge/Next.js%2014-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Yjs CRDT](https://img.shields.io/badge/Yjs-CRDTs-orange?style=for-the-badge)](https://yjs.dev/)
[![Monaco Editor](https://img.shields.io/badge/Monaco-Editor-blue?style=for-the-badge)](https://microsoft.github.io/monaco-editor/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.8%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Express 5](https://img.shields.io/badge/Express-5.x-grey?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)

</div>

---

## 💡 Why Devception?

Traditional competitive coding and LeetCode grinding are **isolated, repetitive, and unrepresentative of real-world software engineering**. In production:
- **65%+ of developer time** is spent reading, debugging, and reviewing code written by others—not writing boilerplate from scratch.
- **76% of engineers** find synthetic algorithmic puzzles disconnected from actual collaborative engineering.

**Devception transforms coding into a team e-sport:**
Think ***Among Us* meets *Google Docs* and *LeetCode***. Players work together in a shared real-time editor to ship functional algorithms against live unit tests, while hidden **Impostors** covertly mutate syntax trees, deploy deceptive AI hints, and induce chaos.

---

## 🎮 Game Roles & Core Mechanics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             MATCHMAKING LOBBY                               │
│                         (4 to 8 Players per Room)                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Roles Assigned Secretly
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
        ┌─────────────────────┐                 ┌─────────────────────┐
        │     DEVELOPERS      │                 │      IMPOSTORS      │
        ├─────────────────────┤                 ├─────────────────────┤
        │ • Multi-cursor Yjs  │                 │ • AST Code Mutator  │
        │ • Solve test suites │                 │ • False Insight AI  │
        │ • Review code diffs │                 │ • Screen Blur Debuff│
        │ • Complete build    │                 │ • Puzzle Matrix Lock│
        └──────────┬──────────┘                 └──────────┬──────────┘
                   │                                       │
                   └───────────────────┬───────────────────┘
                                       ▼
                     ┌───────────────────────────────────┐
                     │         EMERGENCY MEETING         │
                     │    Real-Time Chat & Git Diffs     │
                     │  Council Vote & Impostor Ejection │
                     └───────────────────────────────────┘
```

### 👨‍💻 The Developers
- Work collaboratively in a **Monaco Editor** powered by **Yjs CRDTs** with live multi-cursor presence.
- Implement algorithm solutions across **Arrays, Loops, Recursion, Edge Cases, and String Manipulation**.
- Run automated test suites in a secure, sandboxed execution sandbox.
- Inspect suspicious code alterations, call **Emergency Meetings**, and vote to eject suspected saboteurs.

### 🕵️ The Impostors
- Blend in as helpful teammates while deploying stealth sabotage abilities on server-enforced cooldowns:
  - **AST Code Mutator:** Sneaks logic mutations and syntax landmines into shared functions without triggering trivial wipeouts.
  - **False Insight (Powered by Gemini 2.8 Flash):** Broadcasts convincing, deceptive hints and pseudo-fixes to trick developers into accepting flawed edge cases.
  - **Screen Blur Overlay:** Temporarily blinds target developers' editors with a sensory scramble debuff.
  - **Puzzle Matrix Lock:** Locks down the workspace, forcing developers to solve SVG pattern recognition matrices before they can continue typing.

---

## 🧠 AI Learning Profile & Adaptive Engine

Devception isn't just a party game—it's an intelligent developer diagnostic tool. Built into the user data model is a real-time behavioral telemetry engine:

- **6-Pillar Skill Radar:** Automatically fingerprints player competency across:
  - `Arrays`
  - `Loops`
  - `Recursion`
  - `Edge Cases`
  - `String Manipulation`
  - `Debugging & Self-Correction`
- **AST Mistake Classifier:** When tests fail, our task runner analyzes error signatures (e.g. `off-by-one`, `unhandled null/boundary`, `recursion stack overflow`) and updates individual `mistakeFrequencies`.
- **Adaptive Challenge Selection:** Dynamically queries player weakness telemetry to calibrate match challenges that target blind spots.
- **Google Gemini 2.8 Flash Integration:** Powers dynamic hint generation, deceptive false insight saboteurs, and post-round code review analysis.

---

## 🛠️ Architecture & Tech Stack

```
devception-project/
├── devception-client/         # Next.js 14 App Router Frontend
│   ├── src/app/               # Dynamic routes (play, lobby, auth)
│   ├── src/components/editor/ # Monaco Editor + Yjs CRDT binding
│   ├── src/components/game/   # Sabotages, Voting modal, Puzzle locks
│   └── src/components/landing/# Cinematic cyberpunk landing experience
│
└── devception-server/         # Express 5 + Socket.io Backend
    ├── src/config/            # Environment & MongoDB Atlas validation
    ├── src/models/            # User & Game schemas (Learning Profile, Stats)
    ├── src/services/          # Task Runner, Gemini AI, False Insight, AST Judge
    └── src/socket/            # Room lifecycle, CRDT sync, voting handlers
```

### Frontend (`devception-client`)
- **Framework:** Next.js 14 (App Router) with React 18 & TypeScript
- **Styling & Motion:** Tailwind CSS, Framer Motion, Radix UI primitives, Lucide Icons
- **Editor & CRDTs:** Monaco Editor (`@monaco-editor/react`), `yjs`, `y-monaco`, `y-protocols`
- **State & Networking:** Zustand, Socket.io-client, Axios
- **Auth:** NextAuth.js (Google OAuth + Guest Session Fallback)

### Backend (`devception-server`)
- **Runtime:** Node.js (>= 22.0.0) with Express 5 & TypeScript
- **WebSockets:** Socket.io with `@socket.io/redis-adapter` for horizontal clustering
- **AI Engine:** **Google Gemini 2.8 Flash** via resilient native HTTP streaming with zero-impact fallback
- **Database & Cache:** MongoDB (Mongoose) + Redis (ioredis)
- **Security & Sandboxing:** Protected code range detection, AST validation, Helmet, CORS, JWT, Express Rate Limit

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v20.0.0 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local instance or free MongoDB Atlas URI)
- *(Optional)* [Redis](https://redis.io/) for multi-instance socket clustering
- *(Optional)* [Google Gemini API Key](https://aistudio.google.com/app/apikey) for live Gemini 2.8 Flash generation

---

### 1. Backend Setup (`devception-server`)

```bash
# Navigate to server directory
cd devception-server

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start development server (runs on port 4000)
npm run dev
```

> **Key Environment Variables (`devception-server/.env`):**
> ```env
> PORT=4000
> CLIENT_ORIGIN=http://localhost:3000
> MONGODB_URI=mongodb://localhost:27017/codecrew
> NEXTAUTH_SECRET=dev-secret-change-me
> GEMINI_API_KEY=your-gemini-api-key-here
> GEMINI_MODEL=gemini-2.8-flash
> ```

---

### 2. Frontend Setup (`devception-client`)

```bash
# Navigate to client directory in a new terminal
cd devception-client

# Install dependencies
npm install

# Configure environment
# Ensure .env.local points to your server:
# NEXT_PUBLIC_API_URL=http://localhost:4000/api
# NEXT_PUBLIC_SOCKET_URL=http://localhost:4000

# Start Next.js development server (runs on port 3000)
npm run dev
```

Open **`http://localhost:3000`** in your browser to launch the landing page and enter the game lobby!

---

## 🗺️ Roadmap

- [x] Monaco Editor with live Yjs CRDT multi-cursor sync
- [x] Impostor AST code mutator & screen blur debuffs
- [x] Server-authoritative False Insight engine with Gemini 2.8 Flash
- [x] Interactive SVG algorithmic Puzzle Lock matrix
- [x] AI Learning Profile radar with 6-pillar mistake tracking
- [x] Emergency meeting voting council & ejection cinematics
- [ ] Autonomous AI Impostor bot mode powered by Gemini LLMs
- [ ] Real-world GitHub Pull Request review game modes
- [ ] WebRTC spatial voice chat during emergency meetings
- [ ] In-browser WebAssembly (Wasm) runners for Python, Rust, and C++

---

## 📄 License

This project is open source and available under the [ISC License](LICENSE).
