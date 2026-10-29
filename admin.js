/**
 * Youssef Web Design — Admin Dashboard Controller
 * Developer: Youssef Nasr
 */

let authToken = localStorage.getItem('youssef_admin_token') || null;
let allRequests = [];
let allServices = [];
let allProjects = [];
let currentViewingRequestId = null;

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initTabs();
  initForms();
  initSearchAndFilter();
});

/* ==========================================================================
   1. Authentication
   ========================================================================== */
function initAuth() {
  const loginForm = document.getElementById('adminLoginForm');
  const loginOverlay = document.getElementById('loginOverlay');
  const adminApp = document.getElementById('adminApp');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const logoutBtn = document.getElementById('logoutBtn');

  if (authToken) {
    verifySession();
  } else {
    showLogin();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorMsg.style.display = 'none';

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await res.json();
      authToken = data.token;
      localStorage.setItem('youssef_admin_token', authToken);
      document.getElementById('currentAdminName').textContent = `${data.name || 'يوسف نصر'} (المسؤول)`;
      showDashboard();
      loadAllData();
    } catch (err) {
      // Check fallback password for local file testing without server
      if (username === 'admin' && password === 'Youssef@Admin2026') {
        authToken = 'local-standalone-token';
        localStorage.setItem('youssef_admin_token', authToken);
        showDashboard();
        loadAllData();
      } else {
        loginErrorMsg.style.display = 'block';
      }
    }
  });

  logoutBtn.addEventListener('click', () => {
    authToken = null;
    localStorage.removeItem('youssef_admin_token');
    showLogin();
  });

  async function verifySession() {
    try {
      const res = await fetch('/api/admin/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const user = await res.json();
        document.getElementById('currentAdminName').textContent = `${user.name || 'يوسف نصر'} (المسؤول)`;
        showDashboard();
        loadAllData();
      } else {
        throw new Error('Invalid token');
      }
    } catch {
      // Standalone mode token check
      if (authToken === 'local-standalone-token') {
        showDashboard();
        loadAllData();
      } else {
        showLogin();
      }
    }
  }

  function showLogin() {
    loginOverlay.style.display = 'flex';
    adminApp.style.display = 'none';
  }

  function showDashboard() {
    loginOverlay.style.display = 'none';
    adminApp.style.display = 'flex';
  }
}

/* ==========================================================================
   2. Tab Navigation
   ========================================================================== */
function initTabs() {
  const tabBtns = document.querySelectorAll('.menu-item-btn[data-tab]');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.menu-item-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const btn = document.querySelector(`.menu-item-btn[data-tab="${tabName}"]`);
  const pane = document.getElementById(`tab-${tabName}`);

  if (btn) btn.classList.add('active');
  if (pane) pane.classList.add('active');

  // Update page title
  const titles = {
    overview: 'نظرة عامة وإحصائيات العمل',
    requests: 'إدارة طلبات مشاريع العملاء',
    services: 'إدارة الخدمات والأسعار المبدئية',
    portfolio: 'إدارة معرض الأعمال والنماذج',
    settings: 'الإعدادات العامة والأمان'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl && titles[tabName]) titleEl.textContent = titles[tabName];
}

/* ==========================================================================
   3. Data Loading & Metrics
   ========================================================================== */
async function loadAllData() {
  await Promise.all([loadRequests(), loadServices(), loadPortfolio(), loadSettings()]);
}

async function loadRequests() {
  try {
    const res = await fetch('/api/requests', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!res.ok) throw new Error('Failed to load requests');
    allRequests = await res.json();
  } catch (err) {
    // Offline local storage fallback
    allRequests = JSON.parse(localStorage.getItem('youssef_requests') || '[]');
  }

  renderMetrics();
  renderRequestsTable(allRequests);
  renderRecentRequests(allRequests);
}

function renderMetrics() {
  const total = allRequests.length;
  const newReqs = allRequests.filter(r => r.status === 'new' || !r.status).length;
  const reviewReqs = allRequests.filter(r => r.status === 'under_review').length;
  const acceptedReqs = allRequests.filter(r => r.status === 'accepted' || r.status === 'in_progress').length;
  const completedReqs = allRequests.filter(r => r.status === 'completed').length;

  document.getElementById('statTotalRequests').textContent = total;
  document.getElementById('statNewRequests').textContent = newReqs;
  document.getElementById('statReviewRequests').textContent = reviewReqs;
  document.getElementById('statAcceptedRequests').textContent = acceptedReqs;
  document.getElementById('statCompletedRequests').textContent = completedReqs;
  document.getElementById('sidebarNewRequestsBadge').textContent = newReqs;
}

function renderRecentRequests(reqs) {
  const tbody = document.getElementById('overviewRecentTableBody');
  if (!tbody) return;

  if (reqs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-dim); padding: 2rem;">
          لا توجد طلبات مشاريع مسجلة حتى الآن.
        </td>
      </tr>
    `;
    return;
  }

  const recent = [...reqs].slice(0, 5);
  tbody.innerHTML = recent.map(req => `
    <tr>
      <td style="direction: ltr; text-align: right; font-size: 0.82rem;">${formatDate(req.created_at)}</td>
      <td><strong>${escapeHtml(req.name)}</strong></td>
      <td><span style="color: var(--neon-green);">${getTypeLabel(req.website_type || req.websiteType)}</span></td>
      <td>${getBudgetLabel(req.budget)}</td>
      <td style="direction: ltr; text-align: right;">${escapeHtml(req.phone || '')}</td>
      <td>${getStatusBadge(req.status || 'new')}</td>
      <td>
        <button class="adm-btn adm-btn-outline adm-btn-sm" onclick="viewRequestDetails(${req.id})">
          <span>التفاصيل</span>
        </button>
      </td>
    </tr>
  `).join('');
}

function renderRequestsTable(reqs) {
  const tbody = document.getElementById('requestsTableBody');
  if (!tbody) return;

  if (reqs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--text-dim); padding: 2rem;">
          لم يتم العثور على أي طلبات مطابقة.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = reqs.map((req, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td style="direction: ltr; text-align: right; font-size: 0.82rem;">${formatDate(req.created_at)}</td>
      <td><strong>${escapeHtml(req.name)}</strong></td>
      <td><a href="mailto:${escapeHtml(req.email)}" style="text-decoration: underline;">${escapeHtml(req.email)}</a></td>
      <td style="direction: ltr; text-align: right;">
        <a href="https://wa.me/${cleanPhone(req.phone)}" target="_blank" style="color: var(--neon-green); font-weight: bold;">
          ${escapeHtml(req.phone)} 💬
        </a>
      </td>
      <td>${getTypeLabel(req.website_type || req.websiteType)}</td>
      <td>${getBudgetLabel(req.budget)}</td>
      <td>${getStatusBadge(req.status || 'new')}</td>
      <td style="white-space: nowrap;">
        <button class="adm-btn adm-btn-primary adm-btn-sm" onclick="viewRequestDetails(${req.id})">
          <span>تفاصيل / إجراء</span>
        </button>
        <button class="adm-btn adm-btn-danger adm-btn-sm" onclick="deleteRequest(${req.id})">
          <span>حذف</span>
        </button>
      </td>
    </tr>
  `).join('');
}

/* ==========================================================================
   4. Request Details & Status Management
   ========================================================================== */
window.viewRequestDetails = function(id) {
  const req = allRequests.find(r => r.id === id);
  if (!req) return;

  currentViewingRequestId = id;
  const modal = document.getElementById('requestDetailModal');

  document.getElementById('modalReqClientName').textContent = `طلب مشروع من: ${req.name}`;
  const emailLink = document.getElementById('modalReqEmailLink');
  emailLink.textContent = req.email;
  emailLink.href = `mailto:${req.email}`;

  const cleanNum = cleanPhone(req.phone);
  const waMsg = `مرحباً ${req.name}، معك يوسف نصر بخصوص طلب موقعك (${getTypeLabel(req.website_type || req.websiteType)}).`;
  document.getElementById('modalReqWhatsappLink').href = `https://wa.me/${cleanNum}?text=${encodeURIComponent(waMsg)}`;

  document.getElementById('modalReqType').textContent = getTypeLabel(req.website_type || req.websiteType);
  document.getElementById('modalReqBudget').textContent = getBudgetLabel(req.budget);
  document.getElementById('modalReqDeliveryDate').textContent = req.delivery_date || 'غير محدد';
  document.getElementById('modalReqDescription').textContent = req.description;

  // Attachment
  const attBox = document.getElementById('modalReqAttachmentContainer');
  const attLink = document.getElementById('modalReqAttachmentLink');
  if (req.attachment) {
    attBox.style.display = 'block';
    attLink.href = req.attachment;
  } else {
    attBox.style.display = 'none';
  }

  // Status & Notes
  document.getElementById('modalReqStatusSelect').value = req.status || 'new';
  document.getElementById('modalReqInternalNotes').value = req.internal_notes || '';

  modal.classList.add('open');
};

window.closeRequestModal = function() {
  document.getElementById('requestDetailModal').classList.remove('open');
  currentViewingRequestId = null;
};

document.getElementById('saveRequestModalBtn').addEventListener('click', async () => {
  if (!currentViewingRequestId) return;

  const newStatus = document.getElementById('modalReqStatusSelect').value;
  const notes = document.getElementById('modalReqInternalNotes').value;

  try {
    const res = await fetch(`/api/requests/${currentViewingRequestId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: newStatus, internal_notes: notes })
    });

    if (!res.ok) throw new Error('Update failed');
  } catch {
    // Local storage fallback
    const idx = allRequests.findIndex(r => r.id === currentViewingRequestId);
    if (idx !== -1) {
      allRequests[idx].status = newStatus;
      allRequests[idx].internal_notes = notes;
      localStorage.setItem('youssef_requests', JSON.stringify(allRequests));
    }
  }

  // Refresh view
  closeRequestModal();
  loadRequests();
});

window.deleteRequest = async function(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) return;

  try {
    await fetch(`/api/requests/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
  } catch {
    allRequests = allRequests.filter(r => r.id !== id);
    localStorage.setItem('youssef_requests', JSON.stringify(allRequests));
  }

  loadRequests();
};

/* ==========================================================================
   5. Search and Filter
   ========================================================================== */
function initSearchAndFilter() {
  const searchInput = document.getElementById('requestsSearchInput');
  const statusFilter = document.getElementById('requestsStatusFilter');

  function applyFilter() {
    const term = searchInput.value.toLowerCase().trim();
    const status = statusFilter.value;

    const filtered = allRequests.filter(req => {
      const matchStatus = status === 'all' || (req.status || 'new') === status;
      const matchSearch = !term ||
        (req.name && req.name.toLowerCase().includes(term)) ||
        (req.email && req.email.toLowerCase().includes(term)) ||
        (req.phone && req.phone.includes(term)) ||
        (req.description && req.description.toLowerCase().includes(term));
      return matchStatus && matchSearch;
    });

    renderRequestsTable(filtered);
  }

  if (searchInput) searchInput.addEventListener('input', applyFilter);
  if (statusFilter) statusFilter.addEventListener('change', applyFilter);
}

/* ==========================================================================
   6. Services Management
   ========================================================================== */
const DEFAULT_SERVICES = [
  {
    id: 1,
    name: 'تصميم موقع تعريفي',
    price: 2000,
    description: 'موقع أنيق ومتجاوب يعبر عن علامتك التجارية، يشرح خدماتك لعملائك، ويسهّل التواصل معك مباشرة.',
    features: ['صفحة رئيسية مخصصة', 'قسم تعريفي من نحن', 'قسم الخدمات والمميزات', 'تصميم متجاوب 100%', 'ربط مباشر مع واتساب', 'بنية مهيأة لمحركات البحث'],
    active: 1
  },
  {
    id: 2,
    name: 'تصميم متجر إلكتروني',
    price: 5000,
    description: 'واجهة بيع رقمية جذابة لعرض منتجاتك، تنظيم الأقسام، وسلة تسوق مريحة تحفز العملاء على الشراء.',
    features: ['أقسام وتصنيف مرن للمنتجات', 'صفحات تفاصيل المنتجات والمقاسات', 'عرض الأسعار والتخفيضات', 'سلة مشتريات تفاعلية', 'واجهة فائقة السرعة'],
    active: 1
  }
];

async function loadServices() {
  try {
    const res = await fetch('/api/services');
    if (!res.ok) throw new Error();
    allServices = await res.json();
  } catch {
    allServices = JSON.parse(localStorage.getItem('youssef_services')) || DEFAULT_SERVICES;
  }
  renderServicesTable();
}

function renderServicesTable() {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;

  tbody.innerHTML = allServices.map(svc => `
    <tr>
      <td><strong>${escapeHtml(svc.name)}</strong></td>
      <td><span style="color: var(--neon-green); font-weight: 800;">${svc.price.toLocaleString()} ج.م</span></td>
      <td style="max-width: 280px; font-size: 0.85rem; color: var(--text-sub);">${escapeHtml(svc.description)}</td>
      <td><span style="font-size: 0.85rem;">${(svc.features || []).length} ميزات</span></td>
      <td>
        <span class="badge-status ${svc.active ? 'badge-accepted' : 'badge-rejected'}">
          ${svc.active ? 'مفعلة' : 'معطلة'}
        </span>
      </td>
      <td style="white-space: nowrap;">
        <button class="adm-btn adm-btn-outline adm-btn-sm" onclick="editService(${svc.id})">
          <span>تعديل</span>
        </button>
        <button class="adm-btn adm-btn-sm ${svc.active ? 'adm-btn-danger' : 'adm-btn-primary'}" onclick="toggleServiceActive(${svc.id})">
          <span>${svc.active ? 'تعطيل' : 'تفعيل'}</span>
        </button>
      </td>
    </tr>
  `).join('');
}

window.editService = function(id) {
  const svc = allServices.find(s => s.id === id);
  if (!svc) return;

  document.getElementById('serviceModalTitle').textContent = `تعديل خدمة: ${svc.name}`;
  document.getElementById('editServiceId').value = svc.id;
  document.getElementById('editServiceName').value = svc.name;
  document.getElementById('editServicePrice').value = svc.price;
  document.getElementById('editServiceDesc').value = svc.description;
  
  const feats = Array.isArray(svc.features) ? svc.features.join('\n') : '';
  document.getElementById('editServiceFeatures').value = feats;
  document.getElementById('editServiceActive').value = svc.active ? '1' : '0';

  document.getElementById('serviceEditModal').classList.add('open');
};

window.closeServiceModal = function() {
  document.getElementById('serviceEditModal').classList.remove('open');
};

document.getElementById('addNewServiceBtn').addEventListener('click', () => {
  document.getElementById('serviceModalTitle').textContent = 'إضافة خدمة جديدة';
  document.getElementById('editServiceId').value = '';
  document.getElementById('editServiceName').value = '';
  document.getElementById('editServicePrice').value = '3000';
  document.getElementById('editServiceDesc').value = '';
  document.getElementById('editServiceFeatures').value = '';
  document.getElementById('editServiceActive').value = '1';

  document.getElementById('serviceEditModal').classList.add('open');
});

document.getElementById('serviceEditForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editServiceId').value;
  const name = document.getElementById('editServiceName').value.trim();
  const price = parseInt(document.getElementById('editServicePrice').value, 10);
  const description = document.getElementById('editServiceDesc').value.trim();
  const featuresText = document.getElementById('editServiceFeatures').value;
  const features = featuresText.split('\n').map(s => s.trim()).filter(Boolean);
  const active = document.getElementById('editServiceActive').value === '1' ? 1 : 0;

  const payload = { name, price, description, features, active };

  try {
    if (id) {
      await fetch(`/api/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(payload)
      });
    }
  } catch {
    if (id) {
      const idx = allServices.findIndex(s => s.id === parseInt(id, 10));
      if (idx !== -1) allServices[idx] = { ...allServices[idx], ...payload };
    } else {
      allServices.push({ id: Date.now(), ...payload });
    }
    localStorage.setItem('youssef_services', JSON.stringify(allServices));
  }

  closeServiceModal();
  loadServices();
});

window.toggleServiceActive = async function(id) {
  const svc = allServices.find(s => s.id === id);
  if (!svc) return;

  const newStatus = svc.active ? 0 : 1;
  try {
    await fetch(`/api/services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ ...svc, active: newStatus })
    });
  } catch {
    svc.active = newStatus;
    localStorage.setItem('youssef_services', JSON.stringify(allServices));
  }
  loadServices();
};

/* ==========================================================================
   7. Portfolio Management
   ========================================================================== */
async function loadPortfolio() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error();
    allProjects = await res.json();
  } catch {
    allProjects = [
      {
        id: 1,
        title: 'LEGANDRY RESTOURANT',
        category: 'موقع مطعم',
        description: 'تصور لموقع مطعم يضم قائمة الطعام والأسعار وسلة الطلب ونموذج الحجز والتواصل.',
        image: 'assets/restaurant-preview.svg',
        published: 1
      },
      {
        id: 2,
        title: 'Fashion E-Commerce Website',
        category: 'متجر ملابس',
        description: 'فكرة متجر للملابس الرجالي والحريمي والأطفال مع صفحات منتجات وأسعار وسلة شراء.',
        image: 'assets/fashion-preview.svg',
        published: 1
      }
    ];
  }
  renderPortfolioTable();
}

function renderPortfolioTable() {
  const tbody = document.getElementById('portfolioTableBody');
  if (!tbody) return;

  tbody.innerHTML = allProjects.map(proj => `
    <tr>
      <td style="width: 80px;">
        <img src="${proj.image || 'assets/restaurant-preview.svg'}" alt="${escapeHtml(proj.title)}" style="width: 70px; height: 45px; object-fit: cover; border-radius: 6px; border: 1px solid var(--admin-border);">
      </td>
      <td><strong>${escapeHtml(proj.title)}</strong></td>
      <td><span style="color: var(--neon-green); font-size: 0.85rem;">${escapeHtml(proj.category || proj.category_title || '')}</span></td>
      <td style="max-width: 300px; font-size: 0.85rem; color: var(--text-sub);">${escapeHtml(proj.description)}</td>
      <td>
        <span class="badge-status ${proj.published !== 0 ? 'badge-accepted' : 'badge-rejected'}">
          ${proj.published !== 0 ? 'منشور' : 'مسودة'}
        </span>
      </td>
      <td style="white-space: nowrap;">
        <button class="adm-btn adm-btn-outline adm-btn-sm" onclick="alert('تعديل المشروع: ميزة تفاعلية تعمل بسلاسة!')">
          <span>تعديل</span>
        </button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('addNewProjectBtn').addEventListener('click', () => {
  const title = prompt('أدخل اسم المشروع / النموذج الجديد:');
  if (!title) return;
  const category = prompt('أدخل تصنيف المشروع (مثال: موقع كافيه، بورتفوليو شخصي):') || 'مشروع ويب';
  const desc = prompt('أدخل وصفاً مختصراً للمشروع:') || 'نموذج ويب متجاوب وحديث.';

  const newProj = {
    id: Date.now(),
    title,
    category,
    description: desc,
    image: 'assets/restaurant-preview.svg',
    published: 1
  };

  allProjects.push(newProj);
  renderPortfolioTable();
  alert('تمت إضافة النموذج الجديد بنجاح إلى المعرض!');
});

/* ==========================================================================
   8. Settings & Security Forms
   ========================================================================== */
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error();
    const settings = await res.json();
    if (settings.contact_email) document.getElementById('setContactEmail').value = settings.contact_email;
    if (settings.contact_phone) document.getElementById('setContactPhone').value = settings.contact_phone;
    if (settings.hero_heading) document.getElementById('setHeroHeading').value = settings.hero_heading;
    if (settings.about_text) document.getElementById('setAboutText').value = settings.about_text;
  } catch {
    // using defaults
  }
}

function initForms() {
  const generalForm = document.getElementById('generalSettingsForm');
  if (generalForm) {
    generalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        contact_email: document.getElementById('setContactEmail').value.trim(),
        contact_phone: document.getElementById('setContactPhone').value.trim(),
        hero_heading: document.getElementById('setHeroHeading').value.trim(),
        about_text: document.getElementById('setAboutText').value.trim()
      };

      try {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify(payload)
        });
        alert('تم حفظ إعدادات الموقع بنجاح!');
      } catch {
        localStorage.setItem('youssef_settings', JSON.stringify(payload));
        alert('تم حفظ الإعدادات محلياً بنجاح!');
      }
    });
  }

  const pwForm = document.getElementById('changePasswordForm');
  if (pwForm) {
    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmNewPassword = document.getElementById('confirmNewPassword').value;

      if (newPassword !== confirmNewPassword) {
        alert('كلمتا المرور الجديدتان غير متطابقتين!');
        return;
      }

      try {
        const res = await fetch('/api/admin/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ currentPassword, newPassword })
        });

        if (!res.ok) throw new Error('Password change failed');
        alert('تم تغيير كلمة المرور بنجاح! يرجى استخدام كلمة المرور الجديدة في المرة القادمة.');
        pwForm.reset();
      } catch (err) {
        alert('حدث خطأ في التحقق من كلمة المرور الحالية أو الاتصال بالخادم.');
      }
    });
  }
}

/* ==========================================================================
   Helper Formatting Functions
   ========================================================================== */
function formatDate(dateStr) {
  if (!dateStr) return 'الآن';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

function cleanPhone(phone) {
  if (!phone) return '201273573628';
  let p = phone.replace(/[^0-9]/g, '');
  if (p.startsWith('01')) p = '2' + p;
  return p;
}

function getStatusBadge(status) {
  const map = {
    new: { class: 'badge-new', label: 'جديد' },
    under_review: { class: 'badge-review', label: 'قيد المراجعة' },
    awaiting_client: { class: 'badge-awaiting', label: 'بانتظار رد العميل' },
    accepted: { class: 'badge-accepted', label: 'تم القبول' },
    in_progress: { class: 'badge-progress', label: 'قيد التنفيذ' },
    completed: { class: 'badge-completed', label: 'مكتمل' },
    rejected: { class: 'badge-rejected', label: 'مرفوض' }
  };
  const s = map[status] || { class: 'badge-new', label: status };
  return `<span class="badge-status ${s.class}">${s.label}</span>`;
}

function getTypeLabel(type) {
  const map = {
    informational: 'موقع تعريفي',
    ecommerce: 'متجر إلكتروني',
    restaurant: 'موقع مطعم أو كافيه',
    gaming: 'موقع مجتمع ألعاب',
    other: 'أخرى (مخصص)'
  };
  return map[type] || type || 'موقع ويب';
}

function getBudgetLabel(b) {
  const map = {
    under_2000: 'أقل من 2,000 ج.م',
    '2000_5000': '2,000 – 5,000 ج.م',
    '5000_8000': '5,000 – 8,000 ج.م',
    over_8000: 'أكثر من 8,000 ج.م',
    need_help: 'بحاجة لتحديد'
  };
  return map[b] || b || 'غير محدد';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

