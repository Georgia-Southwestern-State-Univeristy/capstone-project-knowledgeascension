# Knowledge Ascension

Knowledge Ascension is an AI-powered multiplayer study game that turns uploaded study materials into playable quiz combat. The system is designed to make studying more interactive by combining AI-generated question banks, gamified learning mechanics, persistent player progression and multiplayer gameplay.

## Project Goal

This project explores how an AI-powered multiplayer study game can improve engagement with student study materials by turning uploaded documents into interactive gameplay.

## Core Features

- Upload PDF, DOCX, and PPTX study files
- Generate multiple-choice questions using Gemini
- Play using generated questions in Endless Mode, Co-op Boss Battle and 1v1 Multiplayer
- Persistent player profiles with coins, owned characters and equipped character
- Daily task system for repeated engagement
- Local persistence using IndexedDB
- Real-time multiplayer with Socket.IO

## Tech Stack

### Frontend
- React
- Vite
- CSS

### Backend
- Node.js
- Express
- Socket.IO

### AI
- Gemini API

### Storage
- IndexedDB for client-side persistence
- PostgreSQL-ready backend structure for server-side persistence

## System Workflow

1. User uploads a study document
2. Backend extracts text from the file
3. Gemini generates multiple-choice questions
4. Questions are normalized into the game format
5. Game modes consume the generated bank
6. Profile and progression data persist across sessions

## Setup

### Install client
```bash
cd client
npm install
