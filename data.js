// Öğrenciler.Net Veri Katmanı & Durum Yönetimi

// ============================================================
// ROL & YETKİ TANIMLARI
// ============================================================

const ROLE_PERMISSIONS = {
  admin: {
    canCreateTask: true,
    canEditAnyTask: true,
    canDeleteAnyTask: true,
    canManageMembers: true,
    canBulkActions: true,
    canClearActivity: true,
    canExportImport: true,
    canChangeRoles: true,
    canEditOwnTasksOnly: false,
    canDragTasks: true
  },
  member: {
    canCreateTask: true,
    canEditAnyTask: false,
    canEditOwnTasksOnly: true,
    canDeleteAnyTask: false,
    canManageMembers: false,
    canBulkActions: false,
    canClearActivity: false,
    canExportImport: false,
    canChangeRoles: false,
    canDragTasks: true
  },
  viewer: {
    canCreateTask: false,
    canEditAnyTask: false,
    canEditOwnTasksOnly: false,
    canDeleteAnyTask: false,
    canManageMembers: false,
    canBulkActions: false,
    canClearActivity: false,
    canExportImport: false,
    canChangeRoles: false,
    canDragTasks: false
  }
};

const SYSTEM_ROLE_LABELS = {
  admin: 'Admin',
  member: 'Üye',
  viewer: 'İzleyici'
};

// ============================================================
// VARSAYILAN VERİLER
// ============================================================

const DEFAULT_LABELS = [
  { id: 'lbl-bug', name: 'Bug', color: '#ef4444' },
  { id: 'lbl-feature', name: 'Özellik', color: '#8b5cf6' },
  { id: 'lbl-design', name: 'Tasarım', color: '#ec4899' },
  { id: 'lbl-urgent', name: 'Acil', color: '#f97316' },
  { id: 'lbl-docs', name: 'Dokümantasyon', color: '#06b6d4' },
  { id: 'lbl-refactor', name: 'Refaktör', color: '#10b981' }
];

const DEFAULT_MEMBERS = [
  { id: 'm1', name: 'Alex Rivera', role: 'Ürün Tasarımcısı', systemRole: 'admin', pin: '1234', avatar: 'AR', color: '#8b5cf6', joinedDate: '2026-01-10' },
  { id: 'm2', name: 'Sarah Chen', role: 'Frontend Geliştirici', systemRole: 'member', pin: '0000', avatar: 'SC', color: '#06b6d4', joinedDate: '2026-02-15' },
  { id: 'm3', name: 'Marcus Vance', role: 'Backend Mimar', systemRole: 'member', pin: '0000', avatar: 'MV', color: '#10b981', joinedDate: '2026-03-01' },
  { id: 'm4', name: 'Elena Rostova', role: 'QA Lideri', systemRole: 'member', pin: '0000', avatar: 'ER', color: '#f59e0b', joinedDate: '2026-03-22' }
];

const DEFAULT_TASKS = [
  {
    id: 'task-1',
    title: 'Ana Sayfa Yeniden Tasarım',
    description: 'Ana web sitesinin açılış sayfasını 2026 glassmorphism tasarım sistemine uygun olarak yeniden tasarla. Hızlı, akıcı ve premium hissettirmeli.',
    status: 'in-progress',
    priority: 'high',
    assigneeId: 'm2',
    createdBy: 'm1',
    dueDate: '2026-06-05',
    createdDate: '2026-05-20',
    order: 0,
    labels: ['lbl-design', 'lbl-feature'],
    subtasks: [
      { id: 'sub-1-1', title: 'İnteraktif hero bölümü mockup oluştur', completed: true },
      { id: 'sub-1-2', title: 'CSS backdrop-filter kartlarını implement et', completed: true },
      { id: 'sub-1-3', title: 'Görsel varlıkları ve SVG dosyalarını optimize et', completed: false },
      { id: 'sub-1-4', title: 'Erişilebilirlik kontrast testlerini yap', completed: false }
    ],
    comments: [
      { id: 'c1', memberId: 'm1', text: 'Taslak tasarımlar Figma\'da hazır. Fütüristik neon renk paleti kullandım.', timestamp: '2026-05-21T10:30:00Z' },
      { id: 'c2', memberId: 'm2', text: 'Harika görünüyor! Bugün responsive CSS yerleşimini implemente etmeye başlıyorum.', timestamp: '2026-05-22T14:15:00Z' }
    ]
  },
  {
    id: 'task-2',
    title: 'PostgreSQL Geçişi',
    description: 'Ana üretim veritabanını SQLite\'dan PostgreSQL\'e taşı. Daha iyi ölçeklenebilirlik, bağlantı havuzu ve JSON depolama desteği için.',
    status: 'backlog',
    priority: 'high',
    assigneeId: 'm3',
    createdBy: 'm3',
    dueDate: '2026-06-20',
    createdDate: '2026-05-18',
    order: 0,
    labels: ['lbl-refactor'],
    subtasks: [
      { id: 'sub-2-1', title: 'Şema dönüştürme betiği yaz', completed: false },
      { id: 'sub-2-2', title: 'Hazırlık ortamında kuru çalıştırma yap', completed: false },
      { id: 'sub-2-3', title: 'pg_bouncer bağlantı havuzunu yapılandır', completed: false }
    ],
    comments: []
  },
  {
    id: 'task-3',
    title: 'OAuth2 Entegrasyonu',
    description: 'Google ve GitHub OAuth sağlayıcılarını kullanarak güvenli giriş seçeneklerini implement et. Güçlü token yenileme mekanizmaları kur.',
    status: 'todo',
    priority: 'medium',
    assigneeId: 'm3',
    createdBy: 'm1',
    dueDate: '2026-06-12',
    createdDate: '2026-05-22',
    order: 0,
    labels: ['lbl-feature'],
    subtasks: [
      { id: 'sub-3-1', title: 'Geliştirici istemci ID\'lerini kaydet', completed: true },
      { id: 'sub-3-2', title: 'Kimlik doğrulama backend uç noktalarını implement et', completed: false },
      { id: 'sub-3-3', title: 'Kullanıcı profil kartı açılır menüsünü tasarla', completed: false }
    ],
    comments: [
      { id: 'c3', memberId: 'm1', text: 'UI bileşeni entegrasyona hazır olduğunda bana haber verin.', timestamp: '2026-05-23T09:00:00Z' }
    ]
  },
  {
    id: 'task-4',
    title: 'API Performans Denetimi',
    description: 'Sorgu gecikmelerini denetle. Yavaş veritabanı sorgularını tespit et ve uygun indeks yerleşimiyle optimize et.',
    status: 'done',
    priority: 'medium',
    assigneeId: 'm3',
    createdBy: 'm4',
    dueDate: '2026-05-24',
    createdDate: '2026-05-15',
    order: 0,
    labels: ['lbl-refactor'],
    subtasks: [
      { id: 'sub-4-1', title: 'Geliştirme DB\'sinde sorgu profilleyicisini çalıştır', completed: true },
      { id: 'sub-4-2', title: 'task_status üzerinde bileşik indeksler oluştur', completed: true }
    ],
    comments: [
      { id: 'c4', memberId: 'm3', text: 'İndeks dizileri oluşturduktan sonra sorgu süreleri %74 düştü.', timestamp: '2026-05-24T08:00:00Z' }
    ]
  },
  {
    id: 'task-5',
    title: 'E2E Test Altyapısı Kurulumu',
    description: 'Temel uçtan uca kullanıcı iş akışlarını (kimlik doğrulama, görev oluşturma, pano değişiklikleri) otomatize etmek için Playwright yapılandır.',
    status: 'todo',
    priority: 'low',
    assigneeId: 'm4',
    createdBy: 'm4',
    dueDate: '2026-06-18',
    createdDate: '2026-05-23',
    order: 1,
    labels: ['lbl-docs'],
    subtasks: [
      { id: 'sub-5-1', title: 'Test ortamı yapılandırmasını kur', completed: false },
      { id: 'sub-5-2', title: 'Görev yaşam döngüsü kullanıcı testlerini yaz', completed: false }
    ],
    comments: []
  },
  {
    id: 'task-6',
    title: 'Koyu/Açık Tema Geçişi',
    description: 'Koyu mod (varsayılan) ve açık mod arasında dinamik UI geçişi sağla. Kontrast seviyelerinin WCAG AAA standartlarını karşıladığından emin ol.',
    status: 'done',
    priority: 'low',
    assigneeId: 'm1',
    createdBy: 'm1',
    dueDate: '2026-05-22',
    createdDate: '2026-05-19',
    order: 1,
    labels: ['lbl-design', 'lbl-feature'],
    subtasks: [
      { id: 'sub-6-1', title: 'Erişilebilir gri tonlama seviyelerini araştır', completed: true },
      { id: 'sub-6-2', title: 'Özel tema CSS değişkenlerini tanımla', completed: true },
      { id: 'sub-6-3', title: 'Geçiş yerel depolama kancasını implement et', completed: true }
    ],
    comments: [
      { id: 'c5', memberId: 'm4', text: 'Modern mobil Chrome tarayıcılarda erişilebilirlik doğrulandı. Kontrast mükemmel.', timestamp: '2026-05-22T17:40:00Z' }
    ]
  }
];

const STORAGE_KEY = 'zenflow_state';

window.ZenFlowData = {
  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Eski verilerle uyumluluk: eksik alanları ekle
        if (!parsed.labels) parsed.labels = DEFAULT_LABELS;
        if (!parsed.activityLog) parsed.activityLog = [];
        if (!parsed.activeUserId) parsed.activeUserId = parsed.members?.[0]?.id || 'm1';
        // loggedInUserId yoksa null olarak başlat
        if (parsed.loggedInUserId === undefined) parsed.loggedInUserId = null;
        // Görevlere eksik alanlar ekle
        if (parsed.tasks) {
          parsed.tasks.forEach(t => {
            if (!t.labels) t.labels = [];
            if (!t.createdBy) t.createdBy = t.assigneeId;
            if (t.order === undefined) t.order = 0;
          });
        }
        // Üyelere eksik alanlar ekle (eski verilerle uyumluluk)
        if (parsed.members) {
          parsed.members.forEach(m => {
            if (!m.systemRole) m.systemRole = 'member';
            if (!m.pin) m.pin = '0000';
          });
          // En az bir admin olduğundan emin ol
          const hasAdmin = parsed.members.some(m => m.systemRole === 'admin');
          if (!hasAdmin && parsed.members.length > 0) {
            parsed.members[0].systemRole = 'admin';
          }
        }
        return parsed;
      }
    } catch (e) {
      console.error('ZenFlow state yüklenirken hata:', e);
    }
    return this.getDefault();
  },

  getDefault() {
    return {
      tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)),
      members: JSON.parse(JSON.stringify(DEFAULT_MEMBERS)),
      labels: JSON.parse(JSON.stringify(DEFAULT_LABELS)),
      activityLog: [],
      activeUserId: 'm1',
      loggedInUserId: null,
      onboardingDone: false
    };
  },

  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('ZenFlow state kaydedilirken hata:', e);
      return false;
    }
  },

  reset() {
    const defaultState = this.getDefault();
    this.save(defaultState);
    return defaultState;
  }
};
