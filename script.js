/**
 * Youssef Web Design — Client-side JavaScript
 * Developer: Youssef Nasr
 * Brand: Youssef Web Design
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initFooterYear();
  initProjects();
  initFileUpload();
  initRequestForm();
});

/* ==========================================================================
   1. Navigation & Header Scroll Behavior
   ========================================================================== */
function initNavbar() {
  const header = document.getElementById('siteHeader');
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');
  const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');
  const navLinks = document.querySelectorAll('.nav-link');

  // Scroll class for header background blur
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    updateActiveNav();
  }, { passive: true });

  // Mobile menu toggle
  function toggleMobileMenu(open) {
    const isOpen = open !== undefined ? open : !navMenu.classList.contains('active');
    navMenu.classList.toggle('active', isOpen);
    mobileNavBackdrop.classList.toggle('active', isOpen);
    mobileToggle.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => toggleMobileMenu());
  }

  if (mobileNavBackdrop) {
    mobileNavBackdrop.addEventListener('click', () => toggleMobileMenu(false));
  }

  // Close mobile nav on link click
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      toggleMobileMenu(false);
    });
  });

  // Active section tracking on scroll
  function updateActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const scrollPosition = window.scrollY + 160;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      const navItem = document.querySelector(`.nav-link[href="#${id}"]`);

      if (navItem) {
        if (scrollPosition >= top && scrollPosition < top + height) {
          navLinks.forEach(l => l.classList.remove('active'));
          navItem.classList.add('active');
        }
      }
    });
  }
}

/* ==========================================================================
   2. Footer Dynamic Year
   ========================================================================== */
function initFooterYear() {
  const currentYearEl = document.getElementById('currentYear');
  if (currentYearEl) {
    currentYearEl.textContent = new Date().getFullYear();
  }
}

/* ==========================================================================
   3. Projects Data, Filtering, & Modal Preview
   ========================================================================== */
const DEFAULT_PROJECTS = [
  {
    id: 1,
    title: 'LEGANDRY RESTOURANT',
    category_id: 'restaurant',
    category_title: 'موقع مطعم — Restaurant Website Concept',
    badge: 'نموذج أولي / Prototype Concept',
    image: 'restaurant-preview.svg',
    description: 'تصور متكامل لموقع مطعم عصري يضم قائمة طعام تفاعلية، الأسعار، الصور الفوتوغرافية، سلة طلب الطعام، ونموذج حجز الطاولات والتواصل السريع.',
    features: [
      'صفحة رئيسية تعكس هوية المطعم الفاخرة وعروض اليوم.',
      'قائمة طعام (Menu) ديناميكية مصنفة مع الأسعار والصور عالية الدقة.',
      'سلة طلب وجبات سهلة وسريعة مع حساب إجمالي الفاتورة بدقة.',
      'نموذج حجز طاولات تفاعلي لتحديد التاريخ وعدد الأفراد.',
      'نموذج تواصل مباشر وخريطة لموقع المطعم وساعات العمل.',
      'تصميم متجاوب بالكامل وفائق السرعة على جميع الهواتف الذكية.'
    ],
    tags: ['HTML5', 'CSS3', 'JavaScript', 'Food Menu UX', 'Cart System', 'Reservation Form', 'RTL Support']
  },
  {
    id: 2,
    title: 'Fashion E-Commerce Website',
    category_id: 'ecommerce',
    category_title: 'متجر ملابس — Fashion E-Commerce Store',
    badge: 'نموذج أولي / Prototype Concept',
    image: 'fashion-preview.svg',
    description: 'فكرة متجر إلكتروني للملابس الرجالي والحريمي والأطفال مع صفحات استعراض المنتجات والأسعار وخيارات المقاسات وسلة الشراء ولوحة تحكم لإدارة المنتجات.',
    features: [
      'أقسام تسوق منظمة تشمل: رجالي، حريمي، وأطفال.',
      'صفحات تفاصيل المنتجات وخيارات المقاسات (S, M, L, XL) وتحديد الكمية.',
      'عرض تفصيلي للأسعار والعروض الترويجية وخصومات الموسم.',
      'سلة مشتريات ذكية لإدارة المنتجات وحساب تكلفة الشحن.',
      'واجهة دخول وتفاعل العملاء وحفظ المفضلة.',
      'تصور هندسي للوحة تحكم إدارة المنتجات والطلبات للمسؤول.'
    ],
    tags: ['HTML5', 'CSS3', 'JavaScript', 'E-Commerce UI', 'Shopping Cart', 'Product Filtering', 'Responsive Design']
  }
];

let currentProjects = [...DEFAULT_PROJECTS];

function initProjects() {
  // Fetch from backend API if available
  fetch('/api/projects')
    .then(res => {
      if (!res.ok) throw new Error('API not available');
      return res.json();
    })
    .then(data => {
      if (Array.isArray(data) && data.length > 0) {
        currentProjects = data;
        renderProjectsGrid();
      }
    })
    .catch(() => {
      // Offline fallback: already using DEFAULT_PROJECTS
    });

  // Filter Buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');
      filterProjects(filter);
    });
  });

  // Modal event bindings
  bindModalEvents();
}

function filterProjects(category) {
  const cards = document.querySelectorAll('.project-card');
  cards.forEach(card => {
    const cardCategory = card.getAttribute('data-category');
    if (category === 'all' || cardCategory === category) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

function bindModalEvents() {
  // Event delegation for view buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-project');
    if (btn) {
      const projectId = parseInt(btn.getAttribute('data-project-id'), 10);
      openProjectModal(projectId);
    }
  });

  const modalBackdrop = document.getElementById('projectModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeProjectModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        closeProjectModal();
      }
    });
  }

  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProjectModal();
    }
  });
}

function openProjectModal(projectId) {
  const project = currentProjects.find(p => p.id === projectId) || DEFAULT_PROJECTS.find(p => p.id === projectId);
  if (!project) return;

  const modal = document.getElementById('projectModal');
  const modalImg = document.getElementById('modalImg');
  const modalCategory = document.getElementById('modalCategory');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDescription');
  const modalFeaturesList = document.getElementById('modalFeaturesList');
  const modalTags = document.getElementById('modalTags');

  modalImg.src = project.image || 'restaurant-preview.svg';
  modalImg.alt = project.title;
  modalCategory.textContent = project.category_title || project.category || 'تصور ويب';
  modalTitle.textContent = project.title;
  modalDesc.textContent = project.description;

  // Render Features
  modalFeaturesList.innerHTML = '';
  const features = Array.isArray(project.features) 
    ? project.features 
    : (typeof project.features === 'string' ? JSON.parse(project.features) : []);

  features.forEach(feat => {
    const li = document.createElement('li');
    li.textContent = feat;
    modalFeaturesList.appendChild(li);
  });

  // Render Tags
  modalTags.innerHTML = '';
  const tags = Array.isArray(project.tags) 
    ? project.tags 
    : (typeof project.tags === 'string' ? JSON.parse(project.tags) : []);

  tags.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'project-tag';
    span.textContent = tag;
    modalTags.appendChild(span);
  });

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeProjectModal() {
  const modal = document.getElementById('projectModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

// Global helper: preselect service in the form & scroll smoothly
window.preselectService = function(type) {
  const select = document.getElementById('websiteType');
  if (select) {
    if (type === 'informational') select.value = 'informational';
    else if (type === 'ecommerce') select.value = 'ecommerce';
    else if (type === 'restaurant') select.value = 'restaurant';
    else select.value = 'other';
  }

  // Smooth scroll
  const formSection = document.getElementById('request-project');
  if (formSection) {
    formSection.scrollIntoView({ behavior: 'smooth' });
  }

  // Close modal if open
  closeProjectModal();
};

/* ==========================================================================
   4. File Upload Input Interactivity
   ========================================================================== */
function initFileUpload() {
  const fileInput = document.getElementById('projectAttachment');
  const titleEl = document.getElementById('fileUploadTitle');
  const previewEl = document.getElementById('fileNamePreview');

  if (!fileInput) return;

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const maxMb = 5;
      if (file.size > maxMb * 1024 * 1024) {
        alert('حجم الملف كبير جداً! الحد الأقصى المسموح به هو 5 ميجابايت.');
        fileInput.value = '';
        previewEl.style.display = 'none';
        titleEl.textContent = 'اضغط لاختيار ملف أو قم بسحبه هنا';
        return;
      }

      const sizeKb = (file.size / 1024).toFixed(1);
      previewEl.textContent = `الملف المختار: ${file.name} (${sizeKb} KB)`;
      previewEl.style.display = 'block';
      titleEl.textContent = 'تم اختيار الملف بنجاح';
    } else {
      previewEl.style.display = 'none';
      titleEl.textContent = 'اضغط لاختيار ملف أو قم بسحبه هنا';
    }
  });
}

/* ==========================================================================
   5. Project Request Form Submission & WhatsApp Sync
   ========================================================================== */
function initRequestForm() {
  const form = document.getElementById('projectRequestForm');
  const alertBox = document.getElementById('formAlert');
  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  const submitBtnSpinner = document.getElementById('submitBtnSpinner');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset alert
    alertBox.className = 'form-alert';
    alertBox.style.display = 'none';
    alertBox.innerHTML = '';

    // Form values
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const websiteType = form.website_type.value;
    const budget = form.budget.value;
    const deliveryDate = form.delivery_date.value;
    const description = form.description.value.trim();
    const consent = form.consent.checked;

    // Validation
    if (!name || !email || !phone || !websiteType || !budget || !description) {
      showAlert('يرجى ملء جميع الحقول المطلوبة المميزة بعلامة (*).', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('يرجى إدخال بريد إلكتروني صالح وصحيح.', 'error');
      form.email.focus();
      return;
    }

    if (!consent) {
      showAlert('يرجى الموافقة على استخدام البيانات للتواصل معك.', 'error');
      return;
    }

    // Set loading state
    setLoading(true);

    // Prepare FormData
    const formData = new FormData(form);

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server returned error: ${response.status}`);
      }

      const result = await response.json();

      // Show success alert
      showSuccessFeedback(name, phone, websiteType, budget, description);
      form.reset();
      document.getElementById('fileNamePreview').style.display = 'none';
      document.getElementById('fileUploadTitle').textContent = 'اضغط لاختيار ملف أو قم بسحبه هنا';

    } catch (err) {
      console.warn('Backend server communication error, initiating client-side fallback:', err);
      // Graceful offline fallback: save locally + offer direct WhatsApp
      saveLocallyAndFallback(name, email, phone, websiteType, budget, deliveryDate, description);
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    if (loading) {
      submitBtnText.style.display = 'none';
      submitBtnSpinner.style.display = 'inline-block';
    } else {
      submitBtnText.style.display = 'inline-block';
      submitBtnSpinner.style.display = 'none';
    }
  }

  function showAlert(msg, type) {
    alertBox.textContent = msg;
    alertBox.className = `form-alert ${type}`;
    alertBox.style.display = 'block';
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showSuccessFeedback(name, phone, websiteType, budget, description) {
    const typeLabel = getTypeLabel(websiteType);
    const budgetLabel = getBudgetLabel(budget);
    const whatsappMsg = buildWhatsAppMessage(name, phone, typeLabel, budgetLabel, description);
    const whatsappUrl = `https://wa.me/201273573628?text=${encodeURIComponent(whatsappMsg)}`;

    alertBox.className = 'form-alert success';
    alertBox.style.display = 'block';
    alertBox.innerHTML = `
      <div style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem; color: #00ff88;">
        ✅ تم إرسال طلبك وحفظه بنجاح!
      </div>
      <p style="margin-bottom: 1rem; color: #f3f7f5;">
        شكراً لك يا <strong>${escapeHtml(name)}</strong>، تم تسجيل طلبك بنجاح في قاعدة البيانات وسيصل إشعار إلى بريدي الإلكتروني. سأتواصل معك قريباً عبر رقمك (${escapeHtml(phone)}).
      </p>
      <div style="margin-top: 1rem;">
        <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="display: inline-flex;">
          <span>إرسال نسخة فورية عبر واتساب أيضاً</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.541 1.761.814 2.791.814 3.179 0 5.765-2.587 5.766-5.766 0-3.18-2.587-5.766-5.766-5.766zm9.969 5.766c0 5.518-4.482 10-10 10-1.741 0-3.374-.445-4.801-1.229l-5.2 1.363 1.393-5.086c-.886-1.503-1.392-3.245-1.392-5.048 0-5.518 4.482-10 10-10s10 4.482 10 10z"/></svg>
        </a>
      </div>
    `;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function saveLocallyAndFallback(name, email, phone, websiteType, budget, deliveryDate, description) {
    const typeLabel = getTypeLabel(websiteType);
    const budgetLabel = getBudgetLabel(budget);
    
    // Save to localStorage
    const saved = JSON.parse(localStorage.getItem('youssef_requests') || '[]');
    saved.push({
      id: Date.now(),
      name, email, phone, websiteType: typeLabel, budget: budgetLabel, deliveryDate, description,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('youssef_requests', JSON.stringify(saved));

    const whatsappMsg = buildWhatsAppMessage(name, phone, typeLabel, budgetLabel, description);
    const whatsappUrl = `https://wa.me/201273573628?text=${encodeURIComponent(whatsappMsg)}`;

    alertBox.className = 'form-alert success';
    alertBox.style.display = 'block';
    alertBox.innerHTML = `
      <div style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem; color: #00ff88;">
        ✅ تم حفظ تفاصيل طلبك بنجاح!
      </div>
      <p style="margin-bottom: 1rem; color: #f3f7f5;">
        شكراً لك يا <strong>${escapeHtml(name)}</strong>! لضمان وصول طلبك والتواصل الفوري، يمكنك الضغط بالأسفل لفتح محادثة واتساب جاهزة بكافة التفاصيل.
      </p>
      <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
        <span>فتح المحادثة عبر واتساب الآن</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.541 1.761.814 2.791.814 3.179 0 5.765-2.587 5.766-5.766 0-3.18-2.587-5.766-5.766-5.766zm9.969 5.766c0 5.518-4.482 10-10 10-1.741 0-3.374-.445-4.801-1.229l-5.2 1.363 1.393-5.086c-.886-1.503-1.392-3.245-1.392-5.048 0-5.518 4.482-10 10-10s10 4.482 10 10z"/></svg>
      </a>
    `;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function buildWhatsAppMessage(name, phone, type, budget, desc) {
    return `مرحباً يوسف، أنا ${name}. أرغب في طلب مشروع جديد عبر موقعك (Youssef Web Design):\n\n` +
      `▪ نوع الموقع: ${type}\n` +
      `▪ الميزانية المتوقعة: ${budget}\n` +
      `▪ رقم التواصل: ${phone}\n` +
      `▪ تفاصيل المشروع: ${desc}\n\n` +
      `بانتظار ردك لمناقشة التفاصيل والبدء!`;
  }

  function getTypeLabel(type) {
    const map = {
      informational: 'موقع تعريفي',
      ecommerce: 'متجر إلكتروني',
      restaurant: 'موقع مطعم أو كافيه',
      gaming: 'موقع مجتمع ألعاب',
      other: 'أخرى (مخصص)'
    };
    return map[type] || type;
  }

  function getBudgetLabel(b) {
    const map = {
      under_2000: 'أقل من 2,000 ج.م',
      '2000_5000': '2,000 – 5,000 ج.م',
      '5000_8000': '5,000 – 8,000 ج.م',
      over_8000: 'أكثر من 8,000 ج.م',
      need_help: 'أحتاج مساعدة في تحديد الميزانية'
    };
    return map[b] || b;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }
}

