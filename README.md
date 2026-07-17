# 🚀 Asteroids — Blazor WebAssembly

A modern, high-fidelity 2D arcade space shooter built with **Blazor WebAssembly (.NET 10, C# 14)** and the **HTML5 Canvas API**. This project implements a high-performance hybrid architecture combining C# game engine logic with procedural JavaScript rendering and Web Audio API sound synthesis.

---

## 🌟 Key Features

*   **Smooth 60 FPS Rendering:** Driven by a native JavaScript `requestAnimationFrame` loop rendering directly to HTML5 Canvas with neon glow styling, dynamic starfields, and particle explosions.
*   **Hybrid C#/JS Architecture:** Core game physics, state management, entity tracking, and wave mechanics are written in **C# 14**, while input handling, canvas rendering, and procedural audio run in **JavaScript**.
*   **Power-Ups System:**
    *   🛡️ **Shield:** Permanent protection until hit. Absorbs one collision with an asteroid, triggers an explosion, and grants temporary invulnerability.
    *   🔥 **Rapid Fire:** Reduces weapon cooldown to `0.12s` for a rapid barrage (lasts `8` seconds).
    *   🔱 **Triple Shot:** Spreads shots in a three-way arc (lasts `8` seconds).
*   **Leaderboard & Persistence:** Top scores are saved locally in the browser's `localStorage` and displayed as `Score (Survival Time)` (e.g., `12,500 (01:23)`), sorted automatically with the highest score on top.
*   **Mobile-Friendly:** Includes desktop keyboard mappings and a responsive mobile touch-control overlay (Thrust, Rotate Left/Right, Fire).
*   **Dynamic Visuals:** Screen shake on player hits/explosions, particle fireworks on wave completion, and retro scanline visual overlays.

---

## 🕹️ Controls

### Keyboard (Desktop)
| Action | Key Bindings |
| :--- | :--- |
| **Thrust Forward** | `W` / `ArrowUp` |
| **Rotate Left** | `A` / `ArrowLeft` |
| **Rotate Right** | `D` / `ArrowRight` |
| **Brake / Slow Down** | `S` / `ArrowDown` |
| **Fire Laser** | `Spacebar` |
| **Pause / Resume** | `P` |
| **Restart Game** | `Spacebar` (Only on Game Over screen) |

### Touch Controls (Mobile/Tablet)
When loaded on mobile devices, interactive touch zones are displayed at the bottom of the screen:
*   **◀ / ▶:** Rotate ship left or right.
*   **▲:** Engage thrusters.
*   **✸:** Fire primary laser.
*   *Tap Game Over overlay to restart.*

---

## 📊 Gameplay & Balance Constants

*   **Initial Lives:** 3
*   **Starting Wave:** Starts with 8 large asteroids. Each subsequent wave adds `2` additional asteroids and increases their speed.
*   **Invulnerability Window:** `3` seconds of safety granted upon respawning or after shield depletion.
*   **Power-Up Drop Chance:** `15%` chance when any asteroid is destroyed. Pickup templates float in space for `10` seconds before disappearing.
*   **Scoring Breakdown:**
    *   🪐 **Large Asteroid:** 20 points
    *   🪐 **Medium Asteroid:** 50 points
    *   🪐 **Small Asteroid:** 100 points

---

## 🛠️ Build & Run Locally

### Prerequisites
*   [.NET 10.0 SDK](https://dotnet.microsoft.com/download)

### Run the Application
1. Clone the repository and navigate to the project directory:
   ```bash
   cd asteroids_blazor
   ```
2. Restore dependencies and start the local development server:
   ```bash
   dotnet run
   ```
3. Open your browser and navigate to the local hosting address displayed in the terminal console (typically `http://localhost:5000` or `https://localhost:5001`).

### Build for Production
To generate a compiled bundle optimized for static hosting (e.g. GitHub Pages, Azure Static Web Apps, Cloudflare Pages):
```bash
dotnet publish -c Release
```
The output static assets will be located in the `bin/Release/net10.0/publish/wwwroot` folder.

---

## 🏗️ Architecture Deep-Dive

For a detailed walkthrough of the game loop sequence, data structures, JS interop boundaries, and coordinate systems, see [ARCHITECTURE.md](file:///Users/przemek/programming/asteroids_blazor/ARCHITECTURE.md).
