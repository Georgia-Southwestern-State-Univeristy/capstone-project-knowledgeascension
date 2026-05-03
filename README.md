Knowledge Ascension

Overview

Knowledge Ascension is a multiplayer, AI-powered educational game designed to make studying interactive, competitive, and engaging. The platform transforms user-uploaded academic materials into structured multiple-choice questions using generative AI, which are then used in real-time gameplay modes such as Endless Mode, 1v1 battles, and Co-op Boss fights.

The system is designed to encourage active learning, not replace it, by turning studying into a repeatable and rewarding experience.

---

Core Features

- AI-generated study questions from uploaded files (PDF, DOCX, PPTX)
- Endless Mode (solo progression)
- 1v1 Competitive Multiplayer Mode
- Co-op Boss Mode (team-based gameplay)
- Character system with animations and stats
- Daily Tasks system for rewards
- Persistent accounts (coins, characters, progression)
- Real-time multiplayer using WebSockets (Socket.io)

---

Technology Stack

Frontend

- React (Vite)
- CSS (custom UI system)
- IndexedDB (local persistence)

Backend

- Node.js + Express
- Socket.io (real-time multiplayer)

AI Integration

- Google Gemini API (question generation)

---

Installation & Setup

1. Clone Repository

git clone
cd knowledge-ascension

---

2. Install Dependencies

Client

cd client
npm install

Server

cd ../server
npm install

---

3. Environment Variables (Server)

Create a ".env" file in "/server":

GEMINI_API_KEY=your_api_key_here
PORT=5175

---

4. Run the Application

Start Server

cd server
npm run dev

Start Client

cd client
npm run dev

---

5. Access the Game

- Local: http://localhost:5173
- LAN (multiplayer testing): http://YOUR-IP:5173

---

Gameplay Modes

Endless Mode

- Solo mode
- Infinite enemies
- Earn coins based on performance

1v1 Mode

- Real-time multiplayer
- Separate question streams per player
- First to eliminate opponent wins

Co-op Mode

- Team-based boss battle
- Shared boss health
- Timed survival mechanic

---

Project Structure

client/
  src/
    components/
    db/
    auth/

server/
  index.js
  sockets/

---

Testing

- Manual testing across all game modes(completed)
- Multiplayer tested across LAN devices(completed)
- Question validation logic tested for correctness(completed)

---

Known Issues

- Mobile portrait mode need further optimization gor all devices (landscape required)
- AI-generated questions may require refinement for accuracy

---

Future Improvements

- Difficulty scaling for questions
- Ranked matchmaking system
- Cloud database integration (replace IndexedDB)
- Question categorization by subject
- Animation system expansion (attack states, abilities)

---

Authors

- Brandon Nlewem (Lead Developer)
- Team Members: David, Brandon, Lolu

---

License

This project is for academic use (Capstone Project).
