# Tug of War 🏟️

![Tug of War](https://github.com/user-attachments/assets/254d09bd-902d-402c-81af-525394f51785)

A real-time multiplayer tug of war game powered by body motion detection and WebRTC. Players use their body movements to pull the rope and compete against each other in an immersive arena experience.

## ✨ Features

- **Motion-Based Gameplay**: Uses MediaPipe for real-time body pose detection
- **Multiplayer Support**: WebRTC-powered peer-to-peer connections
- **Two Game Modes**:
    - **Gladiator Mode**: Join an existing arena using an arena ID
    - **Arena Mode**: Host a game and invite other players
- **Real-time Video**: See your opponent's movements during gameplay
- **Responsive Design**: Works on desktop and mobile devices
- **Modern Tech Stack**: Built with React, TypeScript, and Vite

## 🚀 Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- A modern web browser with camera access
- Stable internet connection for multiplayer gameplay

### Installation

1. **Clone the repository**

    ```bash
    git clone https://github.com/AlbertSanIza/tug-of-war.git
    cd tug-of-war
    ```

2. **Install dependencies**

    ```bash
    bun install
    ```

3. **Start the development server**

    ```bash
    bun dev
    ```

4. **Open your browser**
   Navigate to `http://localhost:5173` to start playing!

## 🎮 How to Play

### Arena Mode (Host)

1. Click **"Arena"** on the main menu
2. Allow camera access when prompted
3. Share the generated Arena ID with another player
4. Wait for the gladiator to join
5. The game will automatically start with a countdown

### Gladiator Mode (Join)

1. Click **"Gladiator"** on the main menu
2. Enter your name and the Arena ID provided by the host
3. Allow camera access when prompted
4. Wait for the host to start the game
5. Use your body movements to pull the rope!

### Game Controls

- **Pull Left**: Lean your body to the left
- **Pull Right**: Lean your body to the right
- **Win Condition**: Be the first to pull the rope past the victory threshold

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS
- **Routing**: TanStack Router
- **Build Tool**: Vite
- **Motion Detection**: MediaPipe Holistic
- **WebRTC**: PeerJS for peer-to-peer connections
- **UI Components**: Radix UI primitives
- **Animations**: Canvas Confetti for celebrations

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── camera.tsx      # Camera and motion detection logic
│   └── ui/             # UI component library
├── routes/             # Application routes
│   ├── index.tsx       # Main menu
│   ├── arena.tsx       # Arena (host) mode
│   └── gladiator.tsx   # Gladiator (join) mode
└── lib/                # Utility functions and configurations
```

## 🎯 Game Mechanics

- **Motion Detection**: Uses MediaPipe to track body landmarks and calculate lean direction
- **Real-time Sync**: Game state is synchronized between players using WebRTC data channels
- **Victory Condition**: First player to move the rope 4 units in their direction wins
- **Automatic Reset**: Games automatically reset after completion for continuous play
