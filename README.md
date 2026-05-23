# Mikumon

Open-source ISP Management Platform — alternatif Mikhmon V3. Kelola router MikroTik, profil hotspot, pengguna, monitoring real-time, dan laporan penjualan voucher dalam satu dashboard.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Nuxt 3 (SPA), Vue 3, @nuxt/ui v2, Pinia |
| Backend | Bun, Elysia, JWT (httpOnly cookie) |
| Database | PostgreSQL 16, Drizzle ORM |
| Cache | Redis 7 |
| Monorepo | Turborepo, pnpm workspaces |
| Charts | vue-echarts v7 + echarts v5 |

## Fitur

- **Auth** — Login admin, session JWT via httpOnly cookie (30 menit), auto-redirect
- **Routers** — CRUD router MikroTik, test koneksi, enkripsi password (AES-256-GCM)
- **Profiles** — Manajemen profil hotspot per router (harga, durasi, bandwidth)
- **Hotspot Users** — Generate voucher bulk, print voucher, filter & pagination
- **Live Monitoring** — Sesi hotspot aktif real-time via WebSocket, chart traffic top-10
- **Laporan Penjualan** — Revenue per hari/minggu/bulan, breakdown per router, bar chart

## Struktur Proyek

```
mikumon/
├── apps/
│   ├── api/          # Bun + Elysia REST API + WebSocket
│   └── web/          # Nuxt 3 SPA admin panel
├── packages/
│   ├── db/           # Drizzle ORM schema, migrations, seed
│   ├── shared-types/ # TypeScript types bersama
│   ├── validation/   # Zod schemas bersama
│   └── utils/        # Helper: enkripsi, generator, response
├── docker-compose.yml
└── turbo.json
```

## Prasyarat

- [Node.js](https://nodejs.org) >= 20
- [Bun](https://bun.sh) >= 1.0
- [pnpm](https://pnpm.io) >= 9
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Setup Development

### 1. Clone & install dependencies

```bash
git clone https://github.com/nikokevin29/mikumon.git
cd mikumon
pnpm install
```

### 2. Konfigurasi environment

```bash
# Buat file env untuk API
cp .env.example apps/api/.env

# Buat file env untuk Web
echo "NUXT_PUBLIC_API_BASE=http://localhost:3001/api" > apps/web/.env
echo "NUXT_PUBLIC_WS_BASE=ws://localhost:3001" >> apps/web/.env
```

Edit `apps/api/.env` dan sesuaikan nilai berikut:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/mikumon
REDIS_URL=redis://localhost:6379
JWT_SECRET=ganti-dengan-secret-panjang-acak
ENCRYPTION_KEY=ganti-dengan-32-karakter-tepat!!
API_PORT=3001
```

> **Penting:** `ENCRYPTION_KEY` harus tepat 32 karakter — digunakan untuk enkripsi password router.

### 3. Jalankan PostgreSQL + Redis

```bash
# Start hanya database (bukan seluruh stack)
docker compose up -d postgres redis
```

### 4. Migrasi database & seed admin

```bash
cd packages/db
pnpm db:push    # apply schema ke PostgreSQL
pnpm db:seed    # buat akun admin default
```

Akun admin default:
- **Email:** `admin@mikumon.local`
- **Password:** `admin123`

> Ganti password setelah login pertama!

Untuk custom akun seed, tambahkan ke `apps/api/.env`:
```env
ADMIN_EMAIL=email@kamu.com
ADMIN_PASSWORD=passwordkuat
ADMIN_NAME=Nama Admin
```

### 5. Jalankan semua app

```bash
# Kembali ke root
cd ../..
pnpm dev
```

| App | URL |
|-----|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger docs | http://localhost:3001/swagger |
| Health check | http://localhost:3001/health |

## API Endpoints

### Auth
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/auth/login` | Login admin |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Info admin yang login |

### Routers
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/routers` | Daftar router |
| POST | `/api/routers` | Tambah router |
| PUT | `/api/routers/:id` | Edit router |
| DELETE | `/api/routers/:id` | Hapus router |
| POST | `/api/routers/:id/test` | Test koneksi MikroTik |

### Profiles
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/profiles` | Daftar profil (filter: `?router_id=`) |
| POST | `/api/profiles` | Tambah profil |
| PUT | `/api/profiles/:id` | Edit profil |
| DELETE | `/api/profiles/:id` | Hapus profil |

### Hotspot Users
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/hotspot/users` | Daftar user (filter, pagination) |
| POST | `/api/hotspot/users/generate` | Generate voucher bulk |
| DELETE | `/api/hotspot/users/:id` | Hapus user |
| DELETE | `/api/hotspot/users/bulk` | Hapus bulk |

### Monitoring & Reports
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/sessions` | Sesi aktif (REST) |
| WS | `/ws/traffic` | Sesi aktif real-time (WebSocket) |
| GET | `/api/stats` | Statistik ringkasan dashboard |
| GET | `/api/reports/sales` | Laporan penjualan (`?start=&end=&group_by=day\|week\|month`) |

## Deploy dengan Docker

### Full stack (semua service)

```bash
# Buat file .env di root untuk secrets
cp .env.example .env
# Edit .env — isi JWT_SECRET dan ENCRYPTION_KEY

docker compose up -d
```

### Hanya database (development)

```bash
docker compose up -d postgres redis
```

### Hentikan semua

```bash
docker compose down
# Hapus data juga:
docker compose down -v
```

## Scripts

```bash
pnpm dev          # Jalankan semua app (turbo)
pnpm build        # Build semua app
pnpm test         # Jalankan semua tests
pnpm format       # Format kode dengan Prettier
pnpm lint         # Lint semua app

# Database (dari packages/db)
pnpm db:push      # Apply schema (dev)
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Jalankan migrations
pnpm db:studio    # Buka Drizzle Studio (DB GUI)
pnpm db:seed      # Buat admin default
```

## Variabel Environment

### `apps/api/.env`

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string |
| `JWT_SECRET` | — | Secret untuk JWT (min 32 karakter) |
| `ENCRYPTION_KEY` | — | Key enkripsi router password (**tepat 32 karakter**) |
| `API_PORT` | `3001` | Port API server |
| `API_HOST` | `0.0.0.0` | Host API server |
| `MIKROTIK_TIMEOUT` | `30000` | Timeout koneksi MikroTik (ms) |
| `ADMIN_EMAIL` | `admin@mikumon.local` | Email admin seed |
| `ADMIN_PASSWORD` | `admin123` | Password admin seed |
| `ADMIN_NAME` | `Administrator` | Nama admin seed |

### `apps/web/.env`

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `NUXT_PUBLIC_API_BASE` | `http://localhost:3001/api` | URL API backend |
| `NUXT_PUBLIC_WS_BASE` | `ws://localhost:3001` | URL WebSocket backend |

## Lisensi

MIT
