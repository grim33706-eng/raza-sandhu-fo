// ---------- Toast notifications (auto-dismiss after 3s) ----------
function showToast(message, type){
  if (!message) return;
  let stack = document.getElementById('toastStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toastStack';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = `toast-item toast-${type || 'success'}`;
  el.innerHTML = `
    <span class="toast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></svg></span>
    <span class="toast-msg">${message}</span>
  `;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, 3000);
}

// ---------- Theme toggle ----------
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
function applyTheme(t){ root.setAttribute('data-theme', t); localStorage.setItem('raza-theme', t); }
const savedTheme = localStorage.getItem('raza-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(savedTheme);
themeToggle.addEventListener('click', () => {
  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ---------- Nav scroll + mobile toggle ----------
const nav = document.getElementById('siteNav');
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 10));
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

// ---------- GSAP availability + smooth scroll (Lenis) ----------
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const gsapReady = !!(window.gsap && window.ScrollTrigger);
if (gsapReady) gsap.registerPlugin(ScrollTrigger);

let lenis = null;
if (window.Lenis && !prefersReducedMotion) {
  // smoothWheel is OFF: trackpads already send their own native momentum/inertia
  // scroll events, so layering Lenis's artificial smoothing on top of that built-in
  // momentum was exactly what caused the "slow, then suddenly speeds up" feel —
  // two smoothing curves stacked on each other. With smoothWheel off, normal wheel
  // and trackpad scrolling is fully native (instant, 1:1, browser-controlled).
  // Lenis stays active only to power the eased jump when clicking a nav link
  // (lenis.scrollTo below) and to keep ScrollTrigger in sync with real scroll position.
  lenis = new Lenis({ smoothWheel: false, smoothTouch: false });

  if (gsapReady) {
    // Recommended Lenis+GSAP pairing: drive Lenis from GSAP's own ticker instead of
    // running a second requestAnimationFrame loop alongside it.
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  // Smoothly ease into in-page anchors (nav links, "See the results", etc.)
  // instead of the browser's abrupt native jump.
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length <= 1) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -70 });
    });
  });
} else if (!prefersReducedMotion) {
  // Lenis failed to load (CDN hiccup) — fall back to the browser's own native
  // smooth scroll so anchor links and wheel scrolling still feel smooth. This is
  // only ever active when Lenis is absent, so it can never double up with it.
  document.documentElement.style.scrollBehavior = 'smooth';
}

// ---------- Reveal on scroll ----------
// Grouped/list layouts get a staggered GSAP reveal when GSAP is available; their
// children (and a few other GSAP-enhanced elements) are excluded from the plain
// one-by-one fallback below so nothing is ever animated twice. Without GSAP,
// everything just uses the plain fallback — every section still animates in,
// just without the staggered timing.
const staggerGroupSelectors = ['.strat-grid', '.content-pillars', '.market-chips', '.fact-list'];
const staggerGroupEls = gsapReady ? staggerGroupSelectors.flatMap(sel => Array.from(document.querySelectorAll(sel))) : [];
const gsapOnlyEls = gsapReady
  ? [...document.querySelectorAll('.section-head'), ...document.querySelectorAll('.contact-card'), ...document.querySelectorAll('.dash-card')]
  : [];

const revealEls = Array.from(document.querySelectorAll('.reveal, .strat-card, .pillar-card, .exp-card, .fact, .contact-card'))
  .filter(el => !staggerGroupEls.some(group => group.contains(el)) && !gsapOnlyEls.includes(el));

// threshold 0.05 + a negative bottom rootMargin means elements reveal as soon as a
// sliver is on screen, so fast or uneven scrolling can never leave things stranded
// at opacity:0.
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.05, rootMargin: '0px 0px -10% 0px' });
revealEls.forEach(el => { el.classList.add('reveal'); io.observe(el); });

if (gsapReady) {
  // NOTE: these all use gsap.fromTo() with an EXPLICIT end state, not gsap.from().
  // gsap.from() captures the element's current computed style as the "end" value
  // the moment the tween is created — and elements like .strat-card / .pillar-card /
  // .section-head / .dash-card already sit at opacity:0 from the .reveal CSS class
  // at that point (their own IO-driven reveal is intentionally skipped so GSAP can
  // own them instead). That made gsap.from() capture "end opacity = 0" and animate
  // 0 → 0, i.e. permanently invisible.
  staggerGroupSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(group => {
      const children = Array.from(group.children);
      if (!children.length) return;
      gsap.fromTo(children,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08,
          scrollTrigger: { trigger: group, start: 'top 88%' } }
      );
    });
  });

  // Every section heading gets the same subtle rise-in as it scrolls into view
  gsap.utils.toArray('.section-head').forEach(head => {
    gsap.fromTo(head,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out',
        scrollTrigger: { trigger: head, start: 'top 90%' } }
    );
  });

  // Contact cards (WhatsApp, Email, LinkedIn, Location) stagger in together
  const contactCards = gsap.utils.toArray('.contact-card');
  if (contactCards.length) {
    gsap.fromTo(contactCards,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08,
        scrollTrigger: { trigger: '.contact-info', start: 'top 80%' } }
    );
  }

  // Hero entrance — badge, headline, copy, buttons, stats and the snapshot card ease in on load
  gsap.fromTo(['.eyebrow', '.hero h1', '.hero p.lead', '.hero-ctas', '.hero-stats', '.dash-card'],
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.12, delay: 0.1 }
  );
}

// ---------- Three.js hero particle field (purely decorative) ----------
(function initHeroScene(){
  if (prefersReducedMotion) return;
  const canvas = document.getElementById('heroCanvas');
  if (!canvas || !window.THREE || !canvas.clientWidth || !canvas.clientHeight) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  // A soft sphere of drifting purple points — echoes the "network of campaigns/data" idea
  const count = window.innerWidth < 760 ? 260 : 650;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 2.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0x5266eb, size: 0.032, transparent: true, opacity: 0.55 });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let rafId = null;
  function animate(){
    points.rotation.y += 0.0014;
    points.rotation.x += 0.0004;
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  }
  animate();

  function resize(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);

  // Pause the render loop while the hero is scrolled out of view to save CPU/battery
  const sceneIo = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { if (rafId === null) animate(); }
      else if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    });
  }, { threshold: 0 });
  sceneIo.observe(canvas);
})();

// ---------- Strategy card cursor-glow ----------
document.querySelectorAll('.strat-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

// ---------- Count-up stats ----------
const counters = document.querySelectorAll('.hero-stat .num');
const countIO = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const isDecimal = el.dataset.decimal === 'true';
    const duration = 1200;
    const start = performance.now();
    function tick(now){
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      el.textContent = (isDecimal ? val.toFixed(2) : Math.round(val)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    countIO.unobserve(el);
  });
}, { threshold: 0.5 });
counters.forEach(c => countIO.observe(c));

// ---------- Results showcase (tabs, not a slider) ----------
// One item is rendered live in the "stage" browser-frame at a time; clicking a tab
// just swaps the media src/caption text, so only one video ever loads at once.
const resultsTablist = document.getElementById('resultsTablist');
if (resultsTablist) {
  const tabs = Array.from(resultsTablist.querySelectorAll('.result-tab'));
  const stageMedia = document.getElementById('resultsStageMedia');
  const stageUrl = document.getElementById('resultsStageUrl');
  const stageTag = document.getElementById('resultsStageTag');
  const stageTitle = document.getElementById('resultsStageTitle');
  const stageDesc = document.getElementById('resultsStageDesc');
  const stageStats = document.getElementById('resultsStageStats');

  function showTab(tab) {
    tabs.forEach(t => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });

    stageMedia.innerHTML = '';
    if (tab.dataset.type === 'video') {
      const video = document.createElement('video');
      video.controls = true;
      video.preload = 'metadata';
      if (tab.dataset.poster) video.poster = tab.dataset.poster;
      video.src = tab.dataset.media;
      stageMedia.appendChild(video);
      stageUrl.textContent = 'ads.meta.com/campaigns · screen recording';
    } else {
      const img = document.createElement('img');
      img.src = tab.dataset.media;
      img.alt = tab.dataset.title;
      stageMedia.appendChild(img);
      stageUrl.textContent = 'ads.meta.com/campaigns';
    }

    stageTag.textContent = tab.dataset.tag || '';
    stageTag.style.display = tab.dataset.tag ? '' : 'none';
    stageTitle.textContent = tab.dataset.title || '';
    stageDesc.textContent = tab.dataset.desc || '';
    stageDesc.style.display = tab.dataset.desc ? '' : 'none';

    stageStats.innerHTML = '';
    const stats = (tab.dataset.stats || '').split('|').filter(Boolean);
    stats.forEach(s => { const d = document.createElement('div'); d.textContent = s; stageStats.appendChild(d); });
  }

  tabs.forEach(tab => tab.addEventListener('click', () => {
    stageMedia.querySelectorAll('video').forEach(v => v.pause());
    showTab(tab);
  }));

  if (tabs.length) showTab(tabs[0]);
}

// ---------- FAB ----------
const fabWrap = document.getElementById('fabWrap');
const fabMain = document.getElementById('fabMain');
fabMain.addEventListener('click', (e) => { e.stopPropagation(); fabWrap.classList.toggle('open'); });
document.addEventListener('click', (e) => { if (!fabWrap.contains(e.target)) fabWrap.classList.remove('open'); });

// Bug fix: the FAB is fixed to the viewport's bottom-right corner, which is exactly
// where the footer's rightmost social icon sits once you scroll to the bottom of the
// page — the FAB (higher z-index) then physically covers that icon and swallows its
// click. Whenever the footer becomes visible, push the FAB up to clear it.
const siteFooter = document.querySelector('footer');
const FAB_GAP = 26; // matches the default `bottom` value in CSS
function keepFabClearOfFooter(){
  if (!siteFooter) return;
  const footerRect = siteFooter.getBoundingClientRect();
  const overlap = window.innerHeight - footerRect.top;
  fabWrap.style.bottom = overlap > 0 ? `${overlap + FAB_GAP}px` : `${FAB_GAP}px`;
}
keepFabClearOfFooter();
window.addEventListener('scroll', keepFabClearOfFooter, { passive: true });
window.addEventListener('resize', keepFabClearOfFooter);

// ---------- Robust email opener: try Gmail compose tab, fall back to mailto ----------
function openEmail(subject, body){
  const to = 'mr.razasandhu@gmail.com';
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}${body ? '&body=' + encodeURIComponent(body) : ''}`;
  let opened = null;
  try { opened = window.open(gmailUrl, '_blank'); } catch (err) { opened = null; }
  if (!opened || opened.closed || typeof opened.closed === 'undefined') {
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}${body ? '&body=' + encodeURIComponent(body) : ''}`;
  }
}
document.querySelectorAll('.js-email-link').forEach(function(el){
  el.addEventListener('click', function(e){
    e.preventDefault();
    openEmail(el.dataset.subject || "Let's talk about a campaign");
  });
});

// ---------- Contact form: no backend, so this posts straight to FormSubmit.co,
// which forwards it to mr.razasandhu@gmail.com. Submitted with fetch() so the page
// never redirects/reloads and the existing toast notification still fires exactly
// like before.
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', function(e){
    e.preventDefault();
    const submitBtn = contactForm.querySelector('.form-submit');
    const btnLabel = submitBtn ? submitBtn.querySelector('.btn-label') : null;
    if (submitBtn) submitBtn.disabled = true;
    if (btnLabel) btnLabel.textContent = 'Sending...';

    const formData = new FormData(contactForm);
    fetch('https://formsubmit.co/ajax/mr.razasandhu@gmail.com', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: formData,
    })
      .then((res) => res.json())
      .then(() => {
        showToast("Thanks — your message has been sent. Raza will get back to you soon.", 'success');
        contactForm.reset();
      })
      .catch(() => {
        showToast("Something went wrong sending that — please email directly instead.", 'error');
      })
      .finally(() => {
        if (submitBtn) submitBtn.disabled = false;
        if (btnLabel) btnLabel.textContent = 'Send message';
      });
  });
}

// ---------- Experience "snake" connector line ----------
(function initExpPath(){
  const svg = document.getElementById('expSvg');
  const grid = document.getElementById('expGrid');
  const cards = Array.from(grid.querySelectorAll('.exp-card'));
  if (!svg || !cards.length) return;

  svg.innerHTML = `
    <defs>
      <linearGradient id="expGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#9061f9"/>
        <stop offset="100%" stop-color="#6d28d9"/>
      </linearGradient>
    </defs>
    <path class="exp-track" fill="none" stroke="var(--purple-200)" stroke-width="3" stroke-linecap="round"></path>
    <path class="exp-fill" fill="none" stroke="url(#expGrad)" stroke-width="3" stroke-linecap="round"></path>
  `;
  const trackPath = svg.querySelector('.exp-track');
  const fillPath = svg.querySelector('.exp-fill');

  function buildPathD(){
    const gridRect = grid.getBoundingClientRect();
    svg.setAttribute('width', gridRect.width);
    svg.setAttribute('height', gridRect.height);
    svg.setAttribute('viewBox', `0 0 ${gridRect.width} ${gridRect.height}`);

    const pts = cards.map(c => {
      const r = c.getBoundingClientRect();
      return {
        cx: r.left + r.width / 2 - gridRect.left,
        cy: r.top + r.height / 2 - gridRect.top,
        left: r.left - gridRect.left,
        right: r.right - gridRect.left,
        top: r.top - gridRect.top,
        bottom: r.bottom - gridRect.top,
      };
    });

    let d = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const sameRow = Math.abs(a.cy - b.cy) < 12;
      let x1, y1, x2, y2;
      if (sameRow) {
        if (a.cx < b.cx) { x1 = a.right; y1 = a.cy; x2 = b.left; y2 = b.cy; }
        else { x1 = a.left; y1 = a.cy; x2 = b.right; y2 = b.cy; }
      } else {
        if (a.cy < b.cy) { x1 = a.cx; y1 = a.bottom; x2 = b.cx; y2 = b.top; }
        else { x1 = a.cx; y1 = a.top; x2 = b.cx; y2 = b.bottom; }
      }
      d += (i === 0 ? `M ${x1} ${y1} L ${x2} ${y2} ` : `L ${x1} ${y1} L ${x2} ${y2} `);
    }
    return d;
  }

  function render(firstRun){
    const d = buildPathD();
    trackPath.setAttribute('d', d);
    fillPath.setAttribute('d', d);

    if (firstRun) {
      const len = fillPath.getTotalLength();
      fillPath.style.strokeDasharray = len;
      fillPath.style.strokeDashoffset = len;

      if (window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
        gsap.to(fillPath, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: { trigger: grid, start: 'top 78%', end: 'bottom 65%', scrub: 0.6 }
        });
      } else {
        fillPath.style.strokeDashoffset = 0;
      }
    }
  }

  window.addEventListener('load', () => render(true));
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      render(false);
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }, 200);
  });
})();
