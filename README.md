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
*   [.NET 10.0 SDK](https://dotnet.microsoft.com/download) (for the Blazor app)
*   [.NET 8.0 SDK](https://dotnet.microsoft.com/download) (for the API backend)
*   [Azure Functions Core Tools v4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) (for local API hosting)
*   [Azurite](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite) (or an active Azure Storage connection string for local table storage emulator)
*   [Azure Static Web Apps CLI](https://learn.microsoft.com/en-us/azure/static-web-apps/local-development) (`npm install -g @azure/static-web-apps-cli`)

### Run the Application (Frontend + Backend API Proxy)

To run both the Blazor client and the Azure Functions API locally with proper proxying:

1. **Start the local Storage Emulator (Azurite):**
   ```bash
   # If installed via npm:
   azurite --silent
   ```
2. **Start the API backend:**
   In a new terminal:
   ```bash
   cd api
   dotnet restore
   func start
   # This starts the functions on http://localhost:7071
   ```
3. **Start the Blazor client:**
   In another terminal:
   ```bash
   dotnet watch
   # This starts the app on http://localhost:5000 / https://localhost:5001
   ```
4. **Start the SWA CLI Emulator (Proxies both under one port):**
   In a third terminal:
   ```bash
   swa start http://localhost:5000 --api-location http://localhost:7071
   ```
5. Open your browser and navigate to **`http://localhost:4280`** (the SWA emulator port). This port hosts your game and proxies `/api/*` requests to your local functions seamlessly.

### Run client only (offline mode)
If you just want to run the client-side game without the API:
```bash
dotnet run
```
And open the hosting address (e.g. `http://localhost:5000`).

### Build for Production
To generate a compiled bundle optimized for static hosting:
```bash
# Publish the client WASM
dotnet publish -c Release -o ./publish
# Copy staticwebapp config to output
cp staticwebapp.config.json ./publish/wwwroot/staticwebapp.config.json
```
*(The API will be built automatically from `/api` by the Azure SWA deployment action on git push).*

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
export SWA_SKU="Free"      # Free | Standard
export STORAGE_NAME="mystorage431" # Must be globally unique, 3-24 alphanumeric characters
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

Local deploys use the **Azure Static Web Apps CLI** (npm package `@azure/static-web-apps-cli`). The binary is `swa`. You need **Node.js / npm** and a **deployment token** (same secret as GitHub Actions).

#### Build the static site first

```bash
dotnet publish Asteroids.csproj -c Release -o ./publish
cp staticwebapp.config.json ./publish/wwwroot/staticwebapp.config.json
```

#### Get a deployment token

```bash
export SWA_CLI_DEPLOYMENT_TOKEN="$(az staticwebapp secrets list \
  -g "$RESOURCE_GROUP" -n "$SWA_NAME" \
  --query "properties.apiKey" -o tsv)"
```

Or pass `--deployment-token "…"` on every command instead of setting the env var.

#### Two ways to run the CLI (same tool)

| Approach | When to use | How you invoke deploy |
| :--- | :--- | :--- |
| **A. Global `swa`** | Daily local use; CLI already installed | `swa deploy …` |
| **B. `npx`** | No global install; clean machine; scripts/docs that should “just work” | `npx @azure/static-web-apps-cli deploy …` |

There is **no functional difference** for deploy: same CLI, same flags, same token. `npx` only changes *how* the package is downloaded/run.

**A — Install once globally, then use `swa` (recommended for regular local deploys)**

```bash
npm install -g @azure/static-web-apps-cli

swa deploy ./publish/wwwroot --env production
# or explicitly:
# swa deploy ./publish/wwwroot --deployment-token "$SWA_CLI_DEPLOYMENT_TOKEN" --env production
```

**B — Run via `npx` (no global install)**

```bash
npx @azure/static-web-apps-cli deploy ./publish/wwwroot --env production
# or:
# npx @azure/static-web-apps-cli deploy ./publish/wwwroot \
#   --deployment-token "$SWA_CLI_DEPLOYMENT_TOKEN" --env production
```

Optional: pin a CLI version with `npx @azure/static-web-apps-cli@2 …`.

> **Note:** GitHub Actions does **not** use `swa` on the runner. CI uses the `Azure/static-web-apps-deploy` action with secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (see [GitHub CI/CD](#-github-cicd-actions) below).

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

### 6. Setting Up the Global Leaderboard (Azure Storage Table)

To make the global leaderboard work, the backend API requires access to an Azure Storage Table. You can set this up using the Azure CLI using either a secure **System-Assigned Managed Identity (RBAC)** or a traditional **Connection String**.

Ensure you have your variables configured:
```bash
# Verify variables are set in your current shell
echo "Group: $RESOURCE_GROUP, SWA: $SWA_NAME, Storage: $STORAGE_NAME, Location: $LOCATION"
```

#### Step 1: Create the Storage Account & Table
Run these commands to provision the storage resource and create the high-scores table:
```bash
# 1. Create a Standard LRS Storage Account
az storage account create \
  --name "$STORAGE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS

# 2. Create the Table named "AsteroidsLeaderboard"
az storage table create \
  --name "AsteroidsLeaderboard" \
  --account-name "$STORAGE_NAME"
```

#### Step 2: Configure Authentication (Choose Option A or B)

##### Option A: Secure Managed Identity (Recommended - No credentials stored!)
This configures the Azure Static Web App to authenticate using its system-assigned identity to connect securely via Entra ID (Azure AD):

```bash
# 1. Enable System-Assigned Managed Identity on SWA and save the principal ID
export PRINCIPAL_ID=$(az staticwebapp identity assign \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "principalId" \
  -o tsv)

# 2. Retrieve the Storage Account's Azure resource ID
export STORAGE_ID=$(az storage account show \
  --name "$STORAGE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "id" \
  -o tsv)

# 3. Assign "Storage Table Data Contributor" role to the SWA's identity at the Storage Account scope
az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Storage Table Data Contributor" \
  --scope "$STORAGE_ID"

# 4. Set the environment variables on SWA to activate Managed Identity connection mode
az staticwebapp appsettings set \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --setting-names \
    "TableStorageUri=https://$STORAGE_NAME.table.core.windows.net" \
    "TableStorageConnectionString=UseManagedIdentity"
```

##### Option B: Storage Connection String (Traditional)
If you prefer not to use Managed Identity, you can set a connection string:

```bash
# 1. Retrieve the connection string from the storage account keys
export CONNECTION_STRING=$(az storage account show-connection-string \
  --name "$STORAGE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "connectionString" \
  -o tsv)

# 2. Set the connection string variable on SWA
az staticwebapp appsettings set \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --setting-names "TableStorageConnectionString=$CONNECTION_STRING"
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
| `deployment_token was not provided` | Secret is missing or empty. Create **Actions** secret `AZURE_STATIC_WEB_APPS_API_TOKEN` with the SWA deployment token (see above). Fork PR workflows cannot read repo secrets. |
| Deploy step fails with unauthorized | Wrong token, or token for a different SWA app; re-copy from Portal / `az staticwebapp secrets list` |
| Warning: Unexpected input `skip_api_build` | Not a valid input for `Azure/static-web-apps-deploy@v1` — omit it (workflow already does) |
| Tests fail in CI | Run `dotnet test tests/Asteroids.Tests/Asteroids.Tests.csproj -c Release` locally |
| Blank page / 404 on deep links | Ensure `staticwebapp.config.json` is in the deployed `wwwroot` (workflow copies it) |
| Wrong .NET version | Workflow pins `10.0.x` to match `TargetFramework` in `Asteroids.csproj` |

---

## 🏗️ Architecture Deep-Dive

For a detailed walkthrough of the game loop sequence, data structures, JS interop boundaries, and coordinate systems, see [ARCHITECTURE.md](ARCHITECTURE.md).
