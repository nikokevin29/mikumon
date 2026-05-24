# Mikumon

Open-source ISP Management Platform — alternatif Mikhmon V3. Kelola router MikroTik, profil hotspot, pengguna, monitoring real-time, dan laporan penjualan voucher dalam satu dashboard.

## Status Pengembangan

| Modul | Status | Keterangan |
|-------|--------|------------|
| Auth (login/logout/session) | ✅ Selesai | JWT httpOnly cookie, 30 menit |
| Routers CRUD | ✅ Selesai | Enkripsi AES-256-GCM, test koneksi |
| MikroTik RouterOS API Client | ✅ Selesai | Binary protocol TCP port 8728, auth v6/v7 |
| Router Status Real-time | ✅ Selesai | CPU, memori, uptime, board info dari MikroTik |
| Profiles CRUD | ✅ Selesai | Limit uptime/bytes, harga, mode expired |
| Hotspot Users — Generate Voucher | ✅ Selesai | Bulk generate, sync ke MikroTik dengan limits |
| Hotspot Users — CRUD | ✅ Selesai | List, filter, pagination, delete, bulk delete |
| Session Sync Service | ✅ Selesai | Polling MikroTik tiap 30 detik, detect first-use |
| Voucher Lifecycle (usedAt/expiredAt) | ✅ Selesai | Income dicatat saat voucher diaktifkan, bukan saat generate |
| Expiry Sync | ✅ Selesai | Deteksi voucher expired di MikroTik → update DB |
| Dashboard | ✅ Selesai | Stat cards, router status panel, sesi aktif terbaru |
| Sidebar Navigasi | ✅ Selesai | Collapsible, dark mode, active state |
| Live Monitoring (WebSocket) | ✅ Selesai | Sesi aktif real-time, chart traffic |
| Laporan Penjualan | ✅ Selesai | Revenue per hari/minggu/bulan, chart |
| Halaman Hotspot Users | ✅ Selesai | List, filter status, bulk delete, generate voucher |
| Halaman Profiles | ✅ Selesai | CRUD profil, sync ke MikroTik otomatis saat generate |
| Print Voucher | ✅ Selesai | Layout picker (2/3/4 per baris), cut marks, logo toggle |
| PPP Management | ✅ Selesai | List/tambah/hapus PPPoE secrets, lihat & putus sesi aktif |
| DHCP Leases | ✅ Selesai | Tampilkan leases, jadikan static, hapus |
| Telegram Notifikasi | ✅ Selesai | Bot notif first-use voucher & router offline, halaman settings |

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
- **Routers** — CRUD router MikroTik, test koneksi real (RouterOS API), enkripsi password (AES-256-GCM), status real-time inline (CPU, memori, uptime, board info)
- **MikroTik API** — Koneksi langsung ke RouterOS via binary protocol port 8728 (mendukung v6.43+ dan v7.x)
- **Profiles** — Manajemen profil hotspot per router (harga, durasi, bandwidth, mode expired)
- **Hotspot Users** — Generate voucher bulk dengan limit-uptime/bytes, sync ke MikroTik; print voucher dengan layout picker, cut marks, logo toggle
- **Voucher Lifecycle** — Deteksi first-use via session polling, income dicatat saat aktivasi, deteksi expired otomatis
- **PPP Management** — Daftar, tambah, hapus PPPoE secrets; monitor dan putus sesi PPPoE aktif
- **DHCP Leases** — Tampilkan semua DHCP lease per router, jadikan static, hapus
- **Telegram Notifikasi** — Bot notif otomatis: voucher diaktifkan (first-use) dan router tidak bisa dijangkau; konfigurasi via halaman settings
- **Live Monitoring** — Sesi hotspot aktif real-time via WebSocket, chart traffic top-10
- **Laporan Penjualan** — Revenue per hari/minggu/bulan, breakdown per router, bar chart
- **Dashboard** — Stat cards berwarna, panel status router (CPU/memori/uptime), sesi terbaru, akses cepat

## Struktur Proyek

```
mikumon/
├── apps/
│   ├── api/                    # Bun + Elysia REST API + WebSocket
│   │   └── src/
│   │       ├── routes/         # auth, routers, profiles, hotspot, ppp, dhcp, settings, stats, reports, ws
│   │       ├── services/
│   │       │   ├── mikrotik.ts       # RouterOS API binary protocol client
│   │       │   ├── telegram.ts       # Bot Telegram: notif first-use & router offline
│   │       │   └── session-sync.ts   # Background sync: sessions + expiry detection
│   │       └── middleware/
│   └── web/                    # Nuxt 3 SPA admin panel
│       ├── components/
│       │   └── AppSidebar.vue  # Collapsible sidebar navigasi
│       ├── layouts/
│       └── pages/
├── packages/
│   ├── db/                     # Drizzle ORM schema, migrations, seed
│   ├── shared-types/           # TypeScript types bersama
│   ├── validation/             # Zod schemas bersama
│   └── utils/                  # Helper: enkripsi, generator, response
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
| POST | `/api/routers/:id/test` | Test koneksi MikroTik (real API auth) |
| GET | `/api/routers/:id/status` | Status real-time router (CPU, memori, uptime) |
| GET | `/api/routers/:id/active` | Sesi aktif langsung dari MikroTik |

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
| POST | `/api/hotspot/users/generate` | Generate voucher bulk + sync ke MikroTik |
| GET | `/api/hotspot/users/:id` | Detail user |
| PUT | `/api/hotspot/users/:id` | Update user |
| DELETE | `/api/hotspot/users/:id` | Hapus user |
| DELETE | `/api/hotspot/users` | Hapus bulk (`{ ids: [] }`) |

### PPP Management
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/ppp/secrets?routerId=` | Daftar PPPoE secrets |
| POST | `/api/ppp/secrets` | Tambah PPPoE secret |
| DELETE | `/api/ppp/secrets/:id?routerId=` | Hapus PPPoE secret |
| GET | `/api/ppp/active?routerId=` | Sesi PPPoE aktif |
| DELETE | `/api/ppp/active/:id?routerId=` | Putus sesi PPPoE |

### DHCP Leases
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/dhcp/leases?routerId=` | Daftar DHCP leases |
| POST | `/api/dhcp/leases/:id/make-static?routerId=` | Jadikan lease static |
| DELETE | `/api/dhcp/leases/:id?routerId=` | Hapus lease |

### Settings (Telegram)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/settings/telegram` | Ambil konfigurasi Telegram (token disamarkan) |
| PUT | `/api/settings/telegram` | Simpan konfigurasi Telegram |
| POST | `/api/settings/telegram/test` | Kirim pesan test ke bot |

### Monitoring & Reports
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/sessions` | Sesi aktif dari DB (REST) |
| WS | `/ws/traffic` | Sesi aktif real-time (WebSocket) |
| GET | `/api/stats` | Statistik ringkasan dashboard |
| GET | `/api/reports/sales` | Laporan penjualan (`?start=&end=&group_by=day\|week\|month`) |

## Arsitektur Voucher Lifecycle

Berbeda dari Mikhmon yang menyimpan semua data di MikroTik RouterOS, Mikumon menggunakan PostgreSQL sebagai sumber kebenaran dengan sinkronisasi dua arah:

```
Generate Voucher
  └─► DB hotspot_users (username, password, profileId)
  └─► MikroTik /ip/hotspot/user/add (+ limit-uptime, limit-bytes-total)

Session Sync (tiap 30 detik)
  └─► Poll MikroTik /ip/hotspot/active/print
  └─► Upsert DB hotspot_active_sessions
  └─► First-use detected → set hotspot_users.used_at
  └─► Create salesRecords (income dicatat saat aktivasi, bukan saat generate)
  └─► Kirim notif Telegram: "Voucher <user> diaktifkan (profil: X, router: Y)"

Expiry Sync (tiap 5 menit)
  └─► Poll MikroTik /ip/hotspot/user/print
  └─► User hilang dari MikroTik → set hotspot_users.is_active=false, expired_at
  └─► Router tidak bisa dijangkau → Kirim notif Telegram: "Router offline"
```

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
