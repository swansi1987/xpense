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
# Clone
git clone https://github.com/swansi1987/xpense.git
cd xpense

# Install (once Next.js app is set up)
npm install

# Start dev server
npm run dev
```

Open http://localhost:3000 on your phone or computer.

For phone testing on the same network, use your machine's local IP instead of localhost.

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

- This is a **trusted-group** tool. Anyone who knows the trip link and enters a name+phone can participate.
- Always keep a backup of your database (especially SQLite).
- Export your data regularly.

---

Built following the requirements captured in [PRD.txt](./PRD.txt).
