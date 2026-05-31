# Mikumon — ISP Management Desktop App

Aplikasi desktop untuk manajemen MikroTik RouterOS — pengganti Mikhmon berbasis **Tauri + Bun + Nuxt 3**. Tidak perlu server, tidak perlu browser terpisah — cukup buka `.exe`.

## Fitur

### Hotspot Management
- **Live View** — tampilkan semua user langsung dari MikroTik (termasuk user lama)
- **Filter** by Profile, Comment (batch dengan jumlah), dan Search
- **Generate Voucher** — bulk generate user dengan prefix, auto-sync ke MikroTik
- **Cetak Voucher** — layout 2/3/4 per halaman, cut marks, logo
- **Export CSV** — export semua user dengan filter
- **Reset Counter** — reset bytes/uptime counter user di MikroTik
- **Sync dari MikroTik** — import semua user & profile yang sudah ada ke DB lokal
- **IP Bindings** — CRUD MAC/IP binding (bypassed/blocked/regular)
- **Hotspot Hosts** — lihat & hapus host yang terdeteksi
- **Hotspot Cookies** — lihat & hapus cookie autentikasi
- **Hotspot Log** — log aktivitas hotspot dari router

### Router Management
- Multi-router support — kelola beberapa MikroTik sekaligus
- Status real-time — CPU load, memory, uptime, versi RouterOS
- Test koneksi langsung dari UI
- **Reboot / Shutdown** router dari UI
- Password dienkripsi AES-256-GCM di DB lokal

### Network
- **PPP Management** — CRUD PPPoE secrets, lihat & putus sesi aktif
- **DHCP Leases** — lihat lease, jadikan static, hapus

### System
- **Scheduler** — kelola system scheduler MikroTik (enable/disable/hapus/lihat script)

### Monitoring & Laporan
- **Live Monitoring** — WebSocket real-time sesi aktif, chart traffic top 10, disconnect sesi
- **Laporan Penjualan** — grafik revenue harian/mingguan/bulanan per router

### Pengaturan
- Telegram notifikasi — alert saat voucher pertama kali dipakai & router offline

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Desktop** | [Tauri v2](https://tauri.app) (Rust) |
| **Frontend** | [Nuxt 3](https://nuxt.com) + Vue 3, [@nuxt/ui](https://ui.nuxt.com), Pinia, ECharts, VueUse |
| **Backend** | [Bun](https://bun.sh) runtime + [Elysia](https://elysiajs.com) |
| **Database** | SQLite via `bun:sqlite` + [Drizzle ORM](https://orm.drizzle.team) |
| **Validasi** | [Zod](https://zod.dev) |
| **MikroTik API** | Custom binary protocol client (port 8728, RouterOS v6.43+ & v7.x) |
| **Enkripsi** | AES-256-GCM (router password), `Bun.password` (auth hash) |
| **Build** | [Turborepo](https://turbo.build) + pnpm workspaces |
| **Testing** | Bun test — 71 test cases |

---

## Struktur Project

```
mikumon/
├── apps/
│   ├── api/          # Bun + Elysia REST API + WebSocket (port 3001)
│   │   └── src/
│   │       ├── routes/       # auth, routers, hotspot, ppp, dhcp, system, ...
│   │       ├── services/     # mikrotik client, session-sync, telegram
│   │       └── __tests__/    # test routes & services
│   ├── web/          # Nuxt 3 SPA → static build untuk Tauri webview
│   │   └── pages/
│   │       ├── hotspot/      # users, vouchers, ip-bindings, hosts, cookies, log
│   │       ├── system/       # scheduler
│   │       ├── monitoring/   # live sessions
│   │       └── ...
│   └── desktop/      # Tauri project
│       └── src-tauri/
│           ├── src/          # Rust: spawn sidecar, window setup
│           ├── binaries/     # compiled Bun backend (.exe sidecar)
│           └── migrations/   # SQLite migrations (copied at build)
└── packages/
    ├── db/           # Drizzle schema + SQLite client + migrations
    ├── utils/        # encrypt/decrypt, generators, response helpers
    └── validation/   # Zod schemas (shared antara API dan frontend)
```

---

## Build Desktop App

### Prasyarat

- [Bun](https://bun.sh) v1.x
- [Rust](https://rustup.rs) stable (+ cargo)
- [pnpm](https://pnpm.io) v9
- Visual Studio Build Tools (Windows) — untuk Tauri

### Install dependencies

```bash
pnpm install
```

### Build semua sekaligus

```bash
pnpm build:desktop
```

Menjalankan secara berurutan:
1. `pnpm build:api` — compile Bun backend ke `.exe` sidecar
2. `pnpm build:web` — Nuxt static generate
3. `pnpm build:tauri` — build Tauri installer

**Output:**
```
apps/desktop/src-tauri/target/release/bundle/
├── nsis/Mikumon_1.0.0_x64-setup.exe   ← installer (direkomendasikan)
└── msi/Mikumon_1.0.0_x64_en-US.msi
```

Atau jalankan `.exe` langsung tanpa install:
```
apps/desktop/src-tauri/target/release/mikumon.exe
```

> Saat pertama dijalankan, app otomatis:
> - Membuat database di `%APPDATA%\com.mikumon.app\mikumon.db`
> - Menjalankan migrations
> - Spawn backend API di background (port 3001)

---

## Cara Penggunaan

### 1. Tambah Router
**Routers** → **Tambah Router** → isi Nama, IP Address, Username, Password MikroTik → Simpan → klik **Test Koneksi** untuk verifikasi

### 2. Lihat User Hotspot
**Hotspot > Daftar User** → pilih router → data muncul langsung dari MikroTik

**Import user lama:** klik **Sync dari MikroTik** — semua user & profile yang sudah ada di router akan diimport ke DB lokal

### 3. Filter User
| Filter | Fungsi |
|--------|--------|
| **Profile** | Filter by profil bandwidth (3M_48h, 5M_30d, dll) |
| **Comment** | Filter by batch voucher, format: `nama-batch [jumlah]` |
| **Search** | Cari username atau comment |

### 4. Generate Voucher
**Hotspot > Daftar User** → **Generate** → pilih profile → tentukan jumlah & prefix → Generate  
→ Otomatis redirect ke halaman cetak

### 5. Monitor Live
**Live Monitoring** — sesi aktif ter-update setiap 5 detik via WebSocket. Klik ✕ untuk disconnect sesi.

### 6. Reboot / Shutdown Router
**Routers** → expand status panel router → tombol **Reboot** atau **Shutdown**

---

## Development

```bash
# Backend dengan hot reload
pnpm dev:api

# Frontend dev server
pnpm dev:web

# Buka browser → http://localhost:3000
```

### Testing

```bash
# Test utils
pnpm --filter @mikumon/utils test

# Test API (in-memory SQLite + mock MikroTik)
pnpm --filter @mikumon/api test
```

Output:
```
packages/utils: 34 pass, 0 fail
apps/api:       37 pass, 0 fail
Total:          71 pass, 0 fail
```

### Database

```bash
# Generate migration baru setelah ubah schema
pnpm db:generate

# Jalankan migrations manual
pnpm db:migrate
```

---

## Perbandingan dengan Mikhmon v3

| | Mikhmon v3 | Mikumon |
|--|-----------|---------|
| **Stack** | PHP + jQuery | Bun + Nuxt 3 + Tauri |
| **Deployment** | Web server (Nginx + PHP-FPM) | Desktop app (.exe) |
| **Database** | Tidak ada | SQLite lokal |
| **PPP Management** | Tidak diimplementasi | Lengkap |
| **Laporan** | Script di MikroTik | DB lokal, chart |
| **Real-time** | Polling AJAX | WebSocket |
| **Notifikasi** | Tidak ada | Telegram |
| **Testing** | Tidak ada | 71 test cases |
| **Auth** | Login required | Local mode, no login |
