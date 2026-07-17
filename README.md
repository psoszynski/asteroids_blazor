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
dotnet publish -c Release -o ./publish
```
The output static assets will be located in `publish/wwwroot`.

### Run unit tests
```bash
dotnet test tests/Asteroids.Tests/Asteroids.Tests.csproj -c Release
```

---

## ☁️ Azure infrastructure (Static Web Apps)

Standalone Blazor WebAssembly is hosted on **Azure Static Web Apps** (not Linux App Service). Navigation fallback for client-side routes is configured in [`staticwebapp.config.json`](staticwebapp.config.json).

### Prerequisites
* [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed and logged in: `az login`
* An active Azure subscription: `az account show`

### Variables (customize as needed)

```bash
export RESOURCE_GROUP="MyTestRg"
export LOCATION="westeurope"
export SWA_NAME="my-blazor-swa-431"
export SWA_SKU="Free"   # Free | Standard
```

### 1. Resource group

```bash
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION"
```

Skip this step if the group already exists.

### 2. Create the Static Web App

Create the app with **Other** as the source (no GitHub link yet). CI/CD is wired via the workflow and deployment token below.

```bash
az staticwebapp create \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku "$SWA_SKU"
```

### 3. Inspect the site

```bash
# Default hostname (e.g. https://….azurestaticapps.net)
az staticwebapp show \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "defaultHostname" -o tsv

# Deployment token (keep secret — used by GitHub Actions)
az staticwebapp secrets list \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.apiKey" -o tsv
```

### 4. Optional: one-off deploy from your machine

```bash
dotnet publish Asteroids.csproj -c Release -o ./publish
cp staticwebapp.config.json ./publish/wwwroot/staticwebapp.config.json

# Requires Node.js / npm for the SWA CLI
npx @azure/static-web-apps-cli deploy ./publish/wwwroot \
  --deployment-token "$(az staticwebapp secrets list \
    -g "$RESOURCE_GROUP" -n "$SWA_NAME" \
    --query "properties.apiKey" -o tsv)" \
  --env production
```

### 5. Clean up

```bash
# Delete only the Static Web App
az staticwebapp delete \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --yes

# Or delete the entire resource group
az group delete --name "$RESOURCE_GROUP" --yes --no-wait
```

---

## 🔄 GitHub CI/CD (Actions)

Pipeline file: [`.github/workflows/azure-static-web-apps.yml`](.github/workflows/azure-static-web-apps.yml)

### What the workflow does

| Trigger | Job | Behavior |
| :--- | :--- | :--- |
| `push` to `main` | **Build, Test, and Deploy** | Restore → build → test → publish → deploy to production SWA |
| `pull_request` opened/sync/reopened on `main` | **Build, Test, and Deploy** | Same pipeline; SWA creates a **staging** environment for the PR |
| `pull_request` closed | **Close Pull Request** | Tears down the SWA staging environment |

Steps in the main job:

1. **Checkout** repository  
2. **Setup .NET** `10.0.x`  
3. **Restore** app + test projects  
4. **Build** `Asteroids.csproj` (Release)  
5. **Test** `tests/Asteroids.Tests/Asteroids.Tests.csproj`  
6. **Publish** to `./publish` and copy `staticwebapp.config.json` into `wwwroot`  
7. **Deploy** with `Azure/static-web-apps-deploy@v1` (`skip_app_build: true`, upload `publish/wwwroot`)

### Required GitHub secret

| Secret name | Description |
| :--- | :--- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token for the Static Web App (API key) |

`GITHUB_TOKEN` is provided automatically by Actions (used for PR comments / staging). You do **not** add it manually.

#### Add the secret (GitHub UI)

1. Open the repo on GitHub → **Settings** → **Secrets and variables** → **Actions**  
2. **New repository secret**  
3. Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`  
4. Value: output of:

```bash
az staticwebapp secrets list \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.apiKey" -o tsv
```

#### Add the secret (GitHub CLI)

```bash
# Requires: gh auth login
az staticwebapp secrets list \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.apiKey" -o tsv \
| gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN
```

### After setup

```bash
git add .github/workflows/azure-static-web-apps.yml
git commit -m "Add Azure Static Web Apps CI/CD workflow"
git push origin main
```

Then open **Actions** on GitHub and confirm the workflow is green. The live site is:

```text
https://<defaultHostname from az staticwebapp show>
```

Example (this deployment): `https://gray-ocean-0fb38d103.7.azurestaticapps.net`

### Troubleshooting

| Symptom | What to check |
| :--- | :--- |
| Deploy step fails with token / unauthorized | Secret name must be exactly `AZURE_STATIC_WEB_APPS_API_TOKEN`; rotate token in Portal if leaked |
| Tests fail in CI | Run `dotnet test tests/Asteroids.Tests/Asteroids.Tests.csproj -c Release` locally |
| Blank page / 404 on deep links | Ensure `staticwebapp.config.json` is in the deployed `wwwroot` (workflow copies it) |
| Wrong .NET version | Workflow pins `10.0.x` to match `TargetFramework` in `Asteroids.csproj` |

---

## 🏗️ Architecture Deep-Dive

For a detailed walkthrough of the game loop sequence, data structures, JS interop boundaries, and coordinate systems, see [ARCHITECTURE.md](ARCHITECTURE.md).
