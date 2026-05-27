# Öğrenciler.Net — Modüler Yapı

Monolitik `app.js` (2171 satır) 26 ES modülüne bölündü. Davranış birebir aynı; sadece kod organize.

## Hızlı Başlangıç

**Önemli:** ES modülleri `file://` protokolünde çalışmaz (CORS engeli). Tarayıcı `index.html`'i çift tıklayarak açarsan **çalışmaz**. Bir HTTP sunucusu üzerinden açman gerek:

```bash
# Seçenek 1 — Python (kuruluysa)
cd ogrenciler-net-modular
python3 -m http.server 8000
# tarayıcıda http://localhost:8000

# Seçenek 2 — Node (npx)
npx serve ogrenciler-net-modular

# Seçenek 3 — VS Code Live Server eklentisi
# index.html'e sağ tık → "Open with Live Server"
```

Açıldıktan sonra eski versiyonla birebir aynı: m1 + `1234` ile giriş yap.

## Geçiş Notu

Bu arşiv eski projenin **drop-in replacement**'ı değil; yapı değişti. Repona uygularken:

1. Önce eski `app.js` ve `data.js`'i sakla (yedek).
2. Bu arşivin içeriğini repo köküne aç.
3. Eski `index.html`'in başlığı altındaki şu satırı kaldır:
   ```html
   <script src="data.js"></script>
   <script src="app.js"></script>
   ```
4. Yeni `index.html` zaten doğru satırı içeriyor:
   ```html
   <script type="module" src="src/app.js"></script>
   ```
5. `localStorage` anahtarları aynı (`zenflow_state`, `zenflow_theme`, `zenflow_session`); eski verilerini koruyor.

## Modül Haritası

```
src/
├── app.js                  # Bootstrap — tüm modülleri bağlayan tek giriş noktası
├── router.js               # Sayfa geçişi (kanban/list/analytics/...)
├── data.js                 # Default seed verisi (sadece statik veri)
│
├── core/                   # Saf mantık — DOM bağımsız
│   ├── utils.js            # escapeHTML, formatDate, generateId, Math.clamp polyfill, sabitler
│   ├── state.js            # state singleton + saveState + multi-tab sync + migrate
│   ├── permissions.js      # ROLE_PERMISSIONS, hasPermission, canEdit/canDeleteTask
│   ├── undo.js             # 15 derinlikli undo yığını
│   └── activity.js         # logActivity, getMember/getLabel/getSubtaskStats
│
├── ui/                     # Yatay UI primitive'leri
│   ├── dom.js              # $, $$, refreshIcons (Lucide)
│   ├── toast.js            # showToast
│   ├── modal.js            # closeModalAnimated, Escape handler
│   ├── theme.js            # initTheme, toggleTheme
│   └── search.js           # global arama + filterBySearch
│
├── views/                  # Her view kendi modülünde
│   ├── kanban.js           # Pano + drag/drop
│   ├── list.js             # Tablo + filtre + sıralama + bulk
│   ├── analytics.js        # KPI'lar + ring + bar chart
│   ├── team.js             # Ekip kartları + üye silme
│   ├── activity.js         # Aktivite akışı + temizle
│   └── roadmap.js          # Zaman çizelgesi
│
└── features/               # Bağımsız özellikler
    ├── auth.js             # Login, logout, session, applyPermissions
    ├── task-modal.js       # Görev detay modali (en büyük — 320 satır)
    ├── task-create.js      # Yeni görev modali
    ├── member-create.js    # Yeni üye modali
    ├── onboarding.js       # Onboarding modali
    ├── shortcuts.js        # Klavye kısayolları (N, 1-6, /)
    ├── export-import.js    # JSON dışa/içe aktarma
    └── mobile-nav.js       # Hamburger menü + overlay
```

## Mimari Kararlar

**State tek noktada**, `core/state.js` içinde. Modüller `import { state } from './core/state.js'` ile okur, değiştirdiklerinde `saveState()` çağırır. Karmaşık state framework yok; sadece singleton + localStorage.

**Modüller arası iletişim callback ile**, çift yönlü bağımlılık (circular deps) yaratmamak için. Örneğin `kanban.js` "kart tıklanınca ne olacağını" bilmez — `setKanbanTaskClickHandler(openTaskDetailModal)` ile `app.js` bağlar.

**Tek `saveStateAndRerender()`** — `router.js` içinde. Her mutate sonrası bu çağrılır → `saveState()` + `updateSidebarStats()` + `applyPermissions()` + `renderCurrentView()`. Tutarsızlık olmaz.

**Math.clamp polyfill** `core/utils.js`'in en üstünde — herhangi bir view modülü yüklenmeden önce aktif (eski versiyonun temel bug'ıydı).

## Test Listesi (önceki ile aynı)

1. Login: m1 + `1234`
2. Kanban kart sürükle → toast + animasyon
3. Liste'de checkbox seç → bulk bar açılır
4. Analiz → KPI'lar animasyonla artar, ring dolar
5. Ekip'te silme → onay sorar, son admin korunur
6. Mobile (DevTools dar viewport) → hamburger + overlay fade
7. Sarah Chen (`0000`) ile gir → "Yeni Üye" `perm-denied` görünür

## Önceki Bug Düzeltmeleri Korundu

Bir önceki adımda yapılan 13 kritik düzeltmenin hepsi bu yapıya da taşındı. CSS değişmedi.
