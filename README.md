# Agastya

S1000D publication authoring and publishing platform. **Phase 1**: authentication, authorization, user management and role dashboards. **Phase 2, checkpoints 2a to 2c**: project workspaces, data modules, validation (XSD and BREX), graphics, DMRL spreadsheets, PDF output, the publication builder, live build progress, autosaved drafts, approval submission with the content lock, the Author dashboard, and the structured schema-aware editor with the Monaco XML panel. **Phase 3**: the Project Manager dashboard: the approvals queue, review of the frozen submission, decisions with comments, the data module status flow, the rework loop, team activity and Author account management (docs\decisions.md, G1 to G10, B1 to B15, L1 to L4, E1 to E8, M1 to M10).

These steps are for Windows with **PowerShell**. Run every command from the project folder:

```powershell
cd "C:\Users\Deepraj Mhatre\Documents\agastya"
```

## 1. Prerequisites

- **Node.js 24 LTS** (recommended). Node 22.13 or later also works, but prints `ExperimentalWarning: SQLite is an experimental feature`. That warning is harmless.
- Check your version:

```powershell
node --version
```

## 2. Install

```powershell
npm install
npm --prefix client install
```

## 3. Build the client

```powershell
npm run build:client
```

This creates `client\dist`, which the server serves. Rebuild after any change under `client\src`.

## 4. Set the first administrator

The first start creates the single **Software Administrator** from two environment variables. The password must be 8 to 128 characters and not a common password. You will have to change it at first sign-in.

**Option A: environment variables for this PowerShell window only**

```powershell
$env:AGASTYA_INITIAL_ADMIN_USERNAME = "admin"
$env:AGASTYA_INITIAL_ADMIN_PASSWORD = "Bootstrap-Temp-91"
```

**Option B: a `.env` file** (read automatically by `npm start` and `npm run dev`)

```powershell
Copy-Item .env.example .env
notepad .env
```

In `.env`, set:

```
AGASTYA_INITIAL_ADMIN_USERNAME=admin
AGASTYA_INITIAL_ADMIN_PASSWORD=Bootstrap-Temp-91
```

These values are used only while no administrator exists. Once the administrator has been created they are ignored, so you can remove them afterwards.

Optional variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3535` | Port to listen on |
| `AGASTYA_DATA_DIR` | `.\data` | Folder holding `agastya.db` |

## 5. Start the server

```powershell
npm start
```

You should see:

```
[bootstrap] Created Software Administrator "admin" (password change required at first sign-in).
[agastya] listening on http://127.0.0.1:3535
```

Open **http://127.0.0.1:3535**

Stop the server with `Ctrl+C`.

## 6. First sign-in

1. Sign in as `admin` with the bootstrap password you chose.
2. Choose a new password when asked.
3. Go to **Users** and select **Create user** to make a Project Manager and an Author. Each new account gets a temporary password in the form `username@year` (for example `ravi@2026`). It is shown **once**, is valid for **24 hours** and works for **one sign-in**.
4. Sign out, then sign in as the new user with the temporary password. You will be asked to confirm your name and set a password.

Tip: each account allows only one active session, so a new sign-in for the same account signs out the old one. To be signed in as several roles at once, use separate browsers or a private window for each role.

## 7. Development mode (optional)

Development mode reloads automatically when you change code. Use two PowerShell windows. Set the environment variables (step 4) in the first window, or use `.env`.

Window 1, the API server, which restarts when server files change:

```powershell
npm run dev
```

Window 2, the client with hot reload:

```powershell
npm run dev:client
```

Open **http://localhost:5173**. The client forwards `/api` requests to the server on port 3535.

## 8. Reset the administrator password

Nobody can approve the Software Administrator's own forgot-password request. If the administrator password is lost:

1. Stop the server (`Ctrl+C`).
2. Run:

   ```powershell
   npm run reset-admin
   ```

   It prints a temporary password, for example:

   ```
   Temporary password for "admin": admin@2026
   Valid until 2026-10-21T13:44:41.043Z for one sign-in; a new password must be chosen immediately.
   ```

3. Start the server again (`npm start`), sign in with that temporary password and choose a new one.

If you set `AGASTYA_DATA_DIR`, set the same value in the window where you run `npm run reset-admin`.

Other users reset their passwords with **Forgot your password?** on the sign-in page. The request goes to the Project Manager who created them (or to the administrator), who approves it from **Users → Reset requests**.

## 9. Start again from scratch

Stop the server, then delete the data folder. The next start bootstraps a new administrator from the environment variables.

```powershell
Remove-Item -Recurse -Force .\data
```

## 10. Automated tests and checks

```powershell
npm test                  # unit, route, guard-coverage, content and golden tests
npm run test:security     # starts the real server and runs the end-to-end security checks
npm run doctor            # checks that Java, xsltproc, FOP, schemas and pipelines are inside the project
npm run golden            # builds samples\golden to PDF and compares it with the stored baseline
npm run test:e2e          # builds the client and clicks through the real UI in Chromium (screenshots in e2e\screenshots)
npm run test:everything   # all of the above, in order
npm run content-models    # rebuild the editor's S1000D content models from vendor\schemas (only after a schema change)
```

The browser tests use a Chromium installed inside the project. On a fresh copy, install it once with:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "0"; npx playwright install chromium
```

## 11. PDF toolchain

Everything the PDF build needs ships inside the project folder: a Java runtime (`tools\jre`), xsltproc (`tools\libxslt-1.1.28-win32-x86`), Apache FOP (`tools\fop-2.10`), the XSLT pipelines, S1000D schemas and house templates (`vendor\`). Nothing needs to be installed. See `vendor\PROVENANCE.md` for where each part came from. The first PDF build after a restart is slower while FOP warms up.

## Roles

| Role | Creates | Can also |
|---|---|---|
| Software Administrator (one only) | Project Managers, Authors | See everything; add or remove Authors on any project; disable/enable accounts; reset any password; switch users between Project Manager and Author; end sessions |
| Project Manager | Authors | Create and own projects; assign Authors to projects they own; reset passwords of, decide reset requests of, and disable or enable the Authors they created; review and decide the approval requests sent to them (approve, reject or request changes, always with a comment) |
| Author | nobody | Create and own projects; add existing Authors to projects they own; see only projects they own or are assigned to; submit the publication to a Project Manager and resubmit after changes |

Every project has one owner: the Project Manager or Author who created it.

## Documentation

- `docs\architecture.md`: components, authorization model, data model
- `docs\decisions.md`: decisions, the temporary-password risk note, open questions
