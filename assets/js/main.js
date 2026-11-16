// Page behaviour: loader, scroll-driven overlays, timeline reveals, the sideways works
// gallery and the work detail view. The 3D stage lives in scene.js and is loaded lazily,
// so the page still works if WebGL is unavailable.

import { initNoise } from './noise.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const body = document.body;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth <= 640;

/* ───────── Work details (edit these to change what opens from the gallery) ───────── */

const WORKS = {
  sharedesk: {
    title: 'ShareDesk Workplace',
    sub: 'Enterprise collaboration platform  ·  Nuberg Engineering Ltd',
    tags: ['TypeScript', 'React 19', 'RAG', 'Gemini AI', 'LangChain', 'Supabase', 'PostgreSQL', 'WebRTC'],
    body: [
      'An AI-powered enterprise collaboration platform, built during my internship at Nuberg Engineering.',
    ],
    list: ['Semantic document search', 'Contextual Q&A over your documents', 'Real-time collaboration', 'Secure file sharing'],
    link: { href: 'https://sharedesk-workplace.nuberg-workplace.workers.dev/', label: 'Visit the live site' },
  },
  farmhelp: {
    title: 'Farm Help AI',
    sub: 'ML-driven marketplace  ·  Full-stack',
    tags: ['MERN', 'Gemini API', 'Python', 'Web Speech API', 'Dialogflow API', 'Postman'],
    body: [
      'A full-stack, ML-driven marketplace platform that lets farmers transact directly with enterprises.',
    ],
    list: ['AI inference pipelines', 'Real-time data processing', 'Automated decision-support models'],
    link: { href: 'https://github.com/aryanty4gi/farmhelpAI', label: 'View the source on GitHub' },
  },
  alumni: {
    title: 'Alumni Connect',
    sub: 'Alumni–student networking platform  ·  GenAI',
    tags: ['Next.js', 'TypeScript', 'OpenAI API', 'Tailwind CSS'],
    body: [
      'An AI-powered networking platform that connects students with alumni.',
    ],
    list: ['Smart recommendations', 'Automated profile enhancement', 'Intelligent content generation'],
    link: { href: 'https://github.com/aryanty4gi/alumniconnect', label: 'View the source on GitHub' },
  },
  iitmandi: {
    title: 'Session at IIT Mandi',
    sub: 'Speaker  ·  Fetch.ai × Innovation Lab',
    tags: ['Talk', 'AI agents'],
    body: ['Delivered a session at the Indian Institute of Technology Mandi on Fetch.ai and innovation.'],
  },
  bse: {
    title: 'BSE Noida Hackathon',
    sub: 'Organiser',
    tags: ['Hackathon', 'Fetch.ai', 'CXI-MIET'],
    body: ['Helped organise the hackathon held at BSE Noida, one of the events I ran with Fetch.ai’s Innovation Lab and CXI-MIET.'],
  },
  cxi: {
    title: 'CXI-MIET hackathons & sessions',
    sub: 'Coordinator  ·  Apr 2024 – Aug 2026',
    tags: ['4+ hackathons', '10+ sessions', '400+ students'],
    body: ['As coordinator of CXI-MIET, the tech society of MIET, I supported 4+ hackathons and 10+ sessions that engaged 400+ students.'],
  },
  fetch: {
    title: 'Fetch.ai Innovation Lab',
    sub: 'R&D Head · Campus Ambassador  ·  Aug 2025 – Now',
    tags: ['AI agents', 'Hackathons', 'Campus events'],
    body: ['I work on AI agents, organise hackathons and run events on campus with the team.'],
  },
};

/* ───────── Boot ───────── */

const loading = $('#loading');
const arc = $('#loading-arc');

function ready() {
  if (body.classList.contains('is-ready')) return;
  arc.style.strokeDashoffset = '0';
  setTimeout(() => {
    body.classList.add('is-ready');
    loading.classList.add('is-hidden');
    setTimeout(() => loading.remove(), 1100);
  }, 400);
}

// Never leave the visitor on the loader if the 3D stage is slow or unavailable.
const bootTimeout = setTimeout(ready, 7000);

initNoise($('#noise'), { animate: !reducedMotion });

import('./scene.js')
  .then((m) => m.initScene($('#stage'), { reducedMotion }))
  .then((stage) => { window.__stage = stage; clearTimeout(bootTimeout); ready(); })
  .catch((err) => {
    console.warn('[portfolio] 3D stage unavailable, using a static background.', err);
    body.classList.add('no-webgl');
    clearTimeout(bootTimeout);
    ready();
  });

/* ───────── Reveal: résumé title + staggered timeline entries ───────── */

$$('.tl-entry').forEach((entry) => {
  $$('.tl-item', entry).forEach((el, n) => el.style.setProperty('--n', n));
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('show');
      revealObserver.unobserve(e.target);
    }
  },
  { rootMargin: '-12% 0px -12% 0px' }
);
$$('.reveal, .tl-entry').forEach((el) => revealObserver.observe(el));

/* ───────── Scroll-driven overlays ───────── */

const el = {
  scrim: $('#scrim'), fog: $('#fog'), rail: $('#rail'), chrome: $('#chrome'), cue: $('#cue'),
  about: $('#about'), title: $('#about-title'), bodyCopy: $('#about-body'),
  works: $('#works'), gallery: $('#gallery'), track: $('#track'), progress: $('#progress'), hint: $('#hint'),
};

let scrollRange = 0;
function measureGallery() {
  if (isMobile()) {
    scrollRange = 0;
    el.gallery.style.height = '';
    el.track.style.transform = '';
    return;
  }
  // Vertical scroll distance is mapped 1:1 onto the track's horizontal overflow.
  scrollRange = Math.max(0, el.track.scrollWidth - innerWidth);
  el.gallery.style.height = `calc(100vh + ${scrollRange}px)`;
}
measureGallery();
addEventListener('resize', measureGallery);
new ResizeObserver(measureGallery).observe(el.track);
document.fonts?.ready.then(measureGallery);

function update() {
  const y = scrollY;
  const vh = innerHeight;

  el.scrim.style.opacity = (clamp(y / 520) * 0.55).toFixed(3);
  el.cue.style.opacity = (1 - clamp(y / 160)).toFixed(3);
  el.chrome.style.opacity = (1 - clamp(y / 280)).toFixed(3);
  el.rail.style.opacity = clamp((y - vh * 0.5) / (vh * 0.6)).toFixed(3);

  // Hero copy: blurs, fades and drifts apart as it leaves
  const p = clamp((0.6 * vh - el.about.getBoundingClientRect().top) / (0.6 * vh));
  const fade = clamp(p / 0.5);
  el.about.style.opacity = (1 - fade).toFixed(3);
  el.about.style.filter = fade > 0.001 ? `blur(${(fade * 16).toFixed(1)}px)` : '';
  el.title.style.transform = `translateY(${(-96 * p).toFixed(1)}px)`;
  el.title.style.letterSpacing = `${(0.01 + 0.41 * p).toFixed(3)}em`;
  el.bodyCopy.style.transform = `translateY(${(-52 * p).toFixed(1)}px)`;

  // Works: darken the stage as the gallery arrives, then pin and slide sideways
  const worksTop = el.works.getBoundingClientRect().top;
  const fog = clamp((vh - worksTop) / (vh * 0.5));
  el.fog.style.background = `rgba(8, 11, 18, ${(fog * 0.41).toFixed(3)})`;

  if (scrollRange > 0) {
    const g = clamp(-el.gallery.getBoundingClientRect().top / scrollRange);
    el.track.style.transform = `translate3d(${(-g * scrollRange).toFixed(1)}px, 0, 0)`;
    el.progress.style.transform = `scaleX(${g.toFixed(4)})`;
    el.hint.style.opacity = (1 - clamp((g - 0.85) / 0.15)).toFixed(3);
  }
}

(function loop() {
  update();
  requestAnimationFrame(loop);
})();

/* ───────── Work detail ───────── */

const detailRoot = $('#detail-root');
let lastFocus = null;

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function openDetail(key) {
  const w = WORKS[key];
  if (!w) return;
  lastFocus = document.activeElement;
  detailRoot.innerHTML = `
    <div class="wk-detail-backdrop" data-close></div>
    <div class="wk-detail" role="dialog" aria-modal="true" aria-label="${esc(w.title)}">
      <button class="wk-detail-close" data-close aria-label="Close">✕</button>
      <div class="wk-detail-banner is-ph" aria-hidden="true"><span class="wk-detail-ph-text">${esc(w.title)}</span></div>
      <article class="wk-detail-article">
        <header class="wk-detail-head">
          <h3 class="wk-detail-title">${esc(w.title)}</h3>
          ${w.sub ? `<div class="wk-detail-sub">${esc(w.sub)}</div>` : ''}
          ${w.tags?.length ? `<div class="wk-detail-tags">${w.tags.map((t) => `<span class="wk-badge">${esc(t)}</span>`).join('')}</div>` : ''}
        </header>
        ${w.body.map((t) => `<p class="wk-detail-desc">${esc(t)}</p>`).join('')}
        ${w.list?.length ? `<ul class="wk-detail-list">${w.list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${w.link ? `<a class="wk-detail-link" href="${esc(w.link.href)}" target="_blank" rel="noopener noreferrer">${esc(w.link.label)} <span aria-hidden="true">↗</span></a>` : ''}
      </article>
    </div>`;
  body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    detailRoot.classList.add('is-open');
    $('.wk-detail-close', detailRoot).focus();
  });
}

function closeDetail() {
  if (!detailRoot.firstChild) return;
  detailRoot.classList.remove('is-open');
  body.style.overflow = '';
  setTimeout(() => { detailRoot.innerHTML = ''; }, 320);
  lastFocus?.focus?.();
}

document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-work]');
  if (opener) return openDetail(opener.dataset.work);
  if (e.target.closest('[data-close]')) closeDetail();
});
addEventListener('keydown', (e) => e.key === 'Escape' && closeDetail());
