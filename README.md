# Xpense — Travel Expense Dashboard

Simple, mobile-first web app for groups to track and split travel expenses.

No passwords. Just name + phone number to participate. Built for real trips with friends and family.

## Key Features (MVP)

- Passwordless login using **name + phone number**
- Create or join a **Trip**
- Record expenses (ticketing, hotel, food, transport, activities, etc.)
- Flexible splitting:
  - Equal split among everyone
  - Split among a subset of people
  - Custom shares
- Live **balances** and **who-owes-whom** settlement suggestions
- Full expense history with filters
- Mobile optimized (works great in phone browser)
- Export CSV + summary views

## Development Workflow (as requested)

1. Develop locally
2. Push to GitHub: https://github.com/swansi1987/xpense
3. On VPS: `git pull`, build, and deploy

See detailed requirements in [PRD.txt](./PRD.txt).

## Quick Start (Local)

```powershell
git clone https://github.com/swansi1987/xpense.git
cd xpense

npm install
npm run dev
```

Open http://localhost:3000 (or your LAN IP from another phone on the same WiFi).

**How to use on mobile during travel:**
1. Everyone opens the site on their phone browser.
2. Each person enters their own Name + Phone (no password).
3. One person creates the trip and shares the **6-character trip code**.
4. Everyone else joins using the code.

## Development Workflow

1. Develop and test locally (`npm run dev`)
2. `git push` to https://github.com/swansi1987/xpense
3. On VPS:
   ```bash
   git pull
   npm install
   npm run build
   npm start
   # or with PM2 / Docker
   ```

See detailed requirements and data model in [PRD.txt](./PRD.txt).

## Tech Stack (Recommended in PRD)

- Next.js 15 (TypeScript, App Router)
- Tailwind + modern UI components
- SQLite (or PostgreSQL) via Prisma/Drizzle
- Simple custom session (name + phone identification)

Full architecture decisions and data model are in `PRD.txt`.

## Deployment on VPS

Typical flow:

```bash
ssh user@your-vps
cd /opt/xpense
git pull origin main
npm ci
npx prisma migrate deploy
npm run build
pm2 restart xpense   # or docker compose restart
```

HTTPS via nginx + Let's Encrypt (or Caddy) is strongly recommended.

See `PRD.txt` section 13 for full deployment guidance and environment variables.

## Project Structure (Planned)

```
xpense/
├── PRD.txt
├── README.md
├── app/                  # Next.js app router
├── components/
├── lib/                  # db, utils, auth helpers
├── prisma/ or db/        # schema + migrations
├── public/
└── ...
```

## Login Model

- Enter Name + Phone (phone normalized to digits)
- No passwords, no emails, no OTP
- You are identified for the trip(s) you join
- Designed for small trusted travel groups

## Roadmap Highlights (from PRD)

- Receipt photo upload
- Better settlement tracking ("mark paid")
- PWA install on phone
- Trip reports (PDF/shareable)
- Optional Postgres support

## Contributing / Using

This is primarily a personal project for managing real travel expenses.

Pull requests and issues welcome on the GitHub repo.

## Important Notes

- This is a **trusted-group** tool. Anyone who knows the trip code and enters a name+phone can participate.
- Data is stored in memory on the server. **Export your trip regularly** (JSON) as backup.
- On VPS restart you will need to import the last exported file or start a new trip (or add SQLite later).

## Troubleshooting (Windows + Google Drive)

npm install sometimes fails with `ENOTEMPTY` / `EBADF` because of how Google Drive / OneDrive syncs folders.

Run this in PowerShell **from the Xpense folder**:

```powershell
# Stop node if running
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Aggressive clean
cmd /c "rmdir /s /q node_modules 2>nul"
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# Fresh install
npm install
```

Then:

```powershell
npm run dev
```

For phone testing: use your PC's local IP (e.g. `http://192.168.1.105:3000`).

Production builds on a real VPS (Linux) usually don't have these path problems.

## Next improvements you might want

- Switch to SQLite (persistent across restarts)
- Receipt photo upload
- Better settlement "mark as paid"
- CSV export
- PWA "Add to Home Screen" for phones

Let me know what to build next!

---

Built following the requirements captured in [PRD.txt](./PRD.txt).
