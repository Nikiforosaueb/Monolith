/* ============================================================
   script.js — Monolith Architects
   Handles: scroll-driven geometry, section reveals,
            language switcher (EL/EN/ZH/HE), form UX,
            zero-gravity character float animation
   ============================================================ */

(function () {
  'use strict';

  /* ── Utilities ──────────────────────────────────────────── */
  const qs  = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ── Elements ───────────────────────────────────────────── */
  const nav            = qs('#main-nav');
  const sections       = qsa('.section');
  const parallelogram  = qs('#parallelogram');
  const introSection   = qs('#intro');
  const philoSection   = qs('#philosophy');
  const contactSection = qs('#contact');
  const form           = qs('#contact-form');
  const formSuccess    = qs('#form-success');
  const langBtns       = qsa('.lang-btn');

  /* ── State ──────────────────────────────────────────────── */
  let currentLang = 'el';
  let ticking     = false;

  /* ============================================================
     1. INTERSECTION OBSERVER — Section Reveals
     ============================================================ */
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    },
    { threshold: 0.12 }
  );

  sections.forEach((sec) => sectionObserver.observe(sec));

  /* ============================================================
     2. NAVIGATION — scroll-aware styling
     ============================================================ */
  function updateNav() {
    if (window.scrollY > 40) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
  }

  /* ============================================================
     3. ZERO-GRAVITY CHARACTER FLOAT
     
     As user scrolls down past the intro, each character of the
     title drifts upward independently — like floating into air
     with no gravity pulling them back.
     
     Each char gets randomised:
       - float speed multiplier  (some chars rise faster)
       - horizontal nudge        (slight left/right drift)
       - opacity curve           (fades as it rises)
       - blur                    (slight defocus at peak)
     ============================================================ */

  /* Store per-character random params so they stay consistent */
  const charParams = [];

  /* Seeded-ish random using index so it's deterministic */
  function pseudoRandom(seed) {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  }

  /* Split title-line text into individual <span class="char"> */
  function splitTitleChars() {
    const lines = qsa('.title-line');
    let globalIdx = 0;

    lines.forEach((line, lineIdx) => {
      const text = line.textContent;
      line.textContent = '';
      line.setAttribute('aria-label', text); // preserve accessibility

      [...text].forEach((ch, chIdx) => {
        const span       = document.createElement('span');
        span.className   = 'char';
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        span.style.display     = 'inline-block';
        span.style.willChange  = 'transform, opacity, filter';
        span.style.backfaceVisibility = 'hidden';

        /* Randomise float personality per character */
        const r = pseudoRandom(globalIdx * 7 + lineIdx * 31);
        charParams.push({
          speedMult:  0.85 + r * 1.0,          // 0.85 – 1.85× base speed (faster, wider spread)
          driftX:     (pseudoRandom(globalIdx * 13 + 5) - 0.5) * 60, // ±30px horizontal (more dramatic)
          delayFrac:  (globalIdx / 20) * 0.06, // tighter stagger — chars start almost together
          rotateDeg:  (pseudoRandom(globalIdx * 17 + 3) - 0.5) * 20, // ±10° rotation (intense)
        });

        line.appendChild(span);
        globalIdx++;
      });
    });
  }

  /* Animate chars based on intro section scroll progress (0→1) */
  function updateCharFloat() {
    if (!introSection) return;

    const rect     = introSection.getBoundingClientRect();
    const vh       = window.innerHeight;
    /* Natural scroll-driven: 1.1× means animation completes just 
       before the intro section fully scrolls away. Calm and legible. */
    const rawProg  = Math.max(0, (-rect.top / vh) * 1.1);
    const progress = Math.min(1, rawProg);

    const chars = qsa('.char');

    chars.forEach((span, i) => {
      const p = charParams[i];
      if (!p) return;

      /* Each char starts floating at a slightly different scroll position */
      const localProg = Math.max(0, Math.min(1,
        (progress - p.delayFrac * 0.4) * 1.4 * p.speedMult
      ));

      if (localProg <= 0) {
        /* Not yet floating — reset to natural position */
        span.style.transform = '';
        span.style.opacity   = '';
        span.style.filter    = '';
        return;
      }

      /* Eased progress for smoother acceleration */
      const eased = localProg < 0.5
        ? 2 * localProg * localProg
        : -1 + (4 - 2 * localProg) * localProg;

      /* Float upward — max 420px rise, very dramatic */
      const floatY  = -eased * 420 * p.speedMult;

      /* Slight horizontal drift — gives "blown by wind" feel */
      const driftX  = eased * p.driftX;

      /* Subtle rotation as char floats */
      const rotate  = eased * p.rotateDeg;

      /* Opacity: stays at 1 until 10% progress, then fades hard and fast */
      const opacity = localProg < 0.1
        ? 1
        : Math.max(0, 1 - ((localProg - 0.1) / 0.5));

      /* Blur: kicks in after 40% progress — blurs faster */
      const blur    = localProg > 0.4
        ? (localProg - 0.4) / 0.6 * 5
        : 0;

      span.style.transform = `translateY(${floatY}px) translateX(${driftX}px) rotate(${rotate}deg)`;
      span.style.opacity   = opacity;
      span.style.filter    = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : '';
    });

    /* Subtitle elements float slightly after the title chars */
    const floatEls = [
      { el: qs('.intro-label'),        centered: false },
      { el: qs('.intro-statement'),     centered: false },
      { el: qs('.intro-scroll-hint'),   centered: false },
      { el: qs('.intro-right-strip'),   centered: true  }, /* needs -50% centering preserved */
    ];

    floatEls.forEach(({ el, centered }, i) => {
      if (!el) return;
      const localP = Math.max(0, Math.min(1, (progress - 0.02 - i * 0.015) * 2.0));
      const eased  = localP < 0.5
        ? 2 * localP * localP
        : -1 + (4 - 2 * localP) * localP;
      const floatY  = -eased * 300;
      const opacity = localP < 0.08 ? 1 : Math.max(0, 1 - ((localP - 0.08) / 0.5));
      /* For centered elements (right strip), preserve the -50% centering offset */
      el.style.transform = centered
        ? `translateY(calc(-50% + ${floatY}px))`
        : `translateY(${floatY}px)`;
      el.style.opacity = opacity;
    });
  }

  /* ============================================================
     4. PARALLELOGRAM SCROLL ANIMATION
     
     Section 1 (intro)   → para at left, half-visible
     Section 2 (philo)   → para moves RIGHT side of viewport
     Section 3 (contact) → para "completes" — moves to center
     ============================================================ */
  function getSectionProgress(section) {
    const rect = section.getBoundingClientRect();
    const vh   = window.innerHeight;
    const raw  = 1 - (rect.top / vh);
    return Math.max(0, Math.min(1, raw));
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function updateParallelogram() {
    if (!parallelogram) return;

    const vw    = window.innerWidth;
    const paraW = parallelogram.offsetWidth;

    const p2 = getSectionProgress(philoSection);
    const p3 = getSectionProgress(contactSection);

    const xState1 = 0;
    const xState2 = vw - paraW + 60;
    const xState3 = vw / 2 - paraW / 2 + 60;

    let translateX = xState1;
    let scale      = 1;

    if (p2 > 0 && p3 === 0) {
      const t   = easeInOut(Math.min(p2, 1));
      translateX = lerp(xState1, xState2, t);
    } else if (p3 > 0) {
      const t   = easeInOut(Math.min(p3, 1));
      translateX = lerp(xState2, xState3, t);
    }

    if (p3 > 0.5) {
      const closureT = (p3 - 0.5) / 0.5;
      scale = lerp(1, 1.04, easeInOut(closureT));
      const accentLine = qs('.para-accent-line');
      if (accentLine) {
        accentLine.style.opacity = lerp(0.7, 1.0, easeInOut(closureT));
      }
    }

    parallelogram.style.transform =
      `translateX(${translateX}px) scale(${scale})`;
  }

  /* ============================================================
     5. SCROLL HANDLER — RAF-throttled
     ============================================================ */
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateNav();
        updateParallelogram();
        updateCharFloat();
        ticking = false;
      });
      ticking = true;
    }
  }

  /* ============================================================
     6. LANGUAGE SWITCHER
     Supports: el (Greek), en (English), zh (Chinese), he (Hebrew)
     ============================================================ */

  /* Font families per language */
  const langFonts = {
    el: "'Syne', system-ui, sans-serif",
    en: "'Syne', system-ui, sans-serif",
    zh: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    he: "'Noto Sans Hebrew', 'Arial Hebrew', Arial, sans-serif",
  };

  /* Direction per language */
  const langDir = {
    el: 'ltr',
    en: 'ltr',
    zh: 'ltr',
    he: 'rtl',
  };

  /* HTML lang attribute per language */
  const langCode = {
    el: 'el',
    en: 'en',
    zh: 'zh',
    he: 'he',
  };

  /* Switch all translatable text — also re-splits chars for title */
  function applyLanguage(lang) {
    currentLang = lang;
    const body  = document.body;
    const html  = document.documentElement;
    const key   = `data-${lang}`;

    /* Set html[lang] and [dir] */
    html.setAttribute('lang', langCode[lang]);
    html.setAttribute('dir', langDir[lang]);
    body.style.direction = langDir[lang];

    /* Font family */
    body.style.fontFamily = langFonts[lang];

    /* RTL class on body */
    body.classList.toggle('lang-he', lang === 'he');
    body.classList.toggle('lang-zh', lang === 'zh');

    /* All elements with data-el / data-en / etc. */
    qsa(`[${key}]`).forEach((el) => {
      /* Skip title-lines — those are managed by char splitting */
      if (el.classList.contains('title-line')) return;
      const text = el.getAttribute(key);
      if (text) {
        /* Handle HTML inside (like <br> and <em>) */
        if (text.includes('<')) {
          el.innerHTML = text;
        } else {
          el.textContent = text;
        }
      }
    });

    /* Handle title lines: set text then re-split */
    qsa('.title-line').forEach((line) => {
      const newText = line.getAttribute(key);
      if (newText && !newText.includes('<')) {
        /* Restore text temporarily, then re-split */
        line.textContent = newText;
        charParams.length = 0; // clear old params
      }
    });
    /* Re-split after language text updated */
    if (qsa('.title-line').some(l => !l.querySelector('.char'))) {
      splitTitleChars();
    }

    /* Placeholders on inputs / textareas */
    qsa(`[data-placeholder-${lang}]`).forEach((el) => {
      el.placeholder = el.getAttribute(`data-placeholder-${lang}`);
    });

    /* Select option text */
    qsa('select option[data-el]').forEach((opt) => {
      const optText = opt.getAttribute(key);
      if (optText) opt.textContent = optText;
    });

    /* Update active button */
    langBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    /* Mirror philosophy body direction for RTL */
    const philoBody = qs('.philosophy-body');
    if (philoBody && lang === 'he') {
      philoBody.style.borderLeft  = 'none';
      philoBody.style.borderRight = '2px solid var(--clr-accent)';
      philoBody.style.paddingLeft  = '0';
      philoBody.style.paddingRight = '20px';
      philoBody.style.textAlign    = 'right';
    } else if (philoBody) {
      philoBody.style.borderLeft  = '2px solid var(--clr-accent)';
      philoBody.style.borderRight = 'none';
      philoBody.style.paddingLeft  = '20px';
      philoBody.style.paddingRight = '0';
      philoBody.style.textAlign    = '';
    }

    /* Fix form label text-transform for Chinese (no uppercase) */
    const labels = qsa('.form-label');
    if (lang === 'zh' || lang === 'he') {
      labels.forEach((l) => l.style.letterSpacing = '0.05em');
    } else {
      labels.forEach((l) => l.style.letterSpacing = '');
    }

    /* Store preference */
    try { localStorage.setItem('monolith-lang', lang); } catch(e) {}

    /* Sync mobile dropdown: flag in trigger + active option highlight */
    const _mFlag  = qs('#mobile-lang-flag');
    const _flagSrcs = {
      el: 'https://flagcdn.com/20x15/gr.png',
      en: 'https://flagcdn.com/20x15/gb.png',
      zh: 'https://flagcdn.com/20x15/cn.png',
      he: 'https://flagcdn.com/20x15/il.png',
    };
    if (_mFlag && _flagSrcs[lang]) _mFlag.src = _flagSrcs[lang];
    qsa('.mobile-lang-option').forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });
  }

  /* Attach lang button click handlers */
  langBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (lang !== currentLang) {
        applyLanguage(lang);
      }
    });
  });

  /* ── Mobile language dropdown ───────────────────────── */
  const mobileTrigger  = qs('#mobile-lang-trigger');
  const mobileDropdown = qs('#mobile-lang-dropdown');
  const mobileOptions  = qsa('.mobile-lang-option');

  function closeMobileDropdown() {
    if (!mobileDropdown) return;
    mobileDropdown.classList.remove('open');
    mobileDropdown.setAttribute('aria-hidden', 'true');
    if (mobileTrigger) mobileTrigger.setAttribute('aria-expanded', 'false');
  }

  function openMobileDropdown() {
    if (!mobileDropdown) return;
    mobileDropdown.classList.add('open');
    mobileDropdown.setAttribute('aria-hidden', 'false');
    if (mobileTrigger) mobileTrigger.setAttribute('aria-expanded', 'true');
  }

  if (mobileTrigger) {
    mobileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileDropdown.classList.contains('open');
      isOpen ? closeMobileDropdown() : openMobileDropdown();
    });
  }

  /* Mobile options click */
  mobileOptions.forEach((opt) => {
    opt.addEventListener('click', () => {
      const lang = opt.dataset.lang;
      applyLanguage(lang);
      closeMobileDropdown();
    });
  });

  /* Close when clicking outside */
  document.addEventListener('click', (e) => {
    if (mobileDropdown && !mobileDropdown.contains(e.target) && e.target !== mobileTrigger) {
      closeMobileDropdown();
    }
  });

  /* Restore saved language */
  (function restoreLang() {
    try {
      const saved = localStorage.getItem('monolith-lang');
      if (saved && ['el', 'en', 'zh', 'he'].includes(saved)) {
        applyLanguage(saved);
        return;
      }
    } catch(e) {}
    /* Auto-detect browser language */
    const navLang = window.navigator;
    const browserLang = (navLang.language || navLang.userLanguage || 'el').toLowerCase();
    if (browserLang.startsWith('zh')) applyLanguage('zh');
    else if (browserLang.startsWith('he')) applyLanguage('he');
    else if (browserLang.startsWith('en')) applyLanguage('en');
    else applyLanguage('el');
  })();

  /* ============================================================
     7. CONTACT FORM — client-side UX
     ============================================================ */
  if (form) {
    const inputs = qsa('.form-input, .form-textarea, .form-select', form);
    inputs.forEach((input) => {
      input.addEventListener('blur', () => {
        input.classList.toggle('has-value', !!input.value.trim());
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const submitBtn  = qs('#form-submit-btn');
      const submitText = qs('.submit-text', submitBtn);
      submitBtn.disabled = true;
      submitText.textContent = '...';
      
      setTimeout(() => {
        form.style.opacity    = '0';
        form.style.transition = 'opacity 0.4s ease';
        setTimeout(() => {
          form.style.display = 'none';
          formSuccess.classList.add('visible');
          /* Translate success message */
          applyLanguage(currentLang);
        }, 400);
      }, 800);
    });
  }

  /* ============================================================
     8. SMOOTH ANCHOR SCROLLING
     ============================================================ */
  qsa('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = qs(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ============================================================
     9. INIT
     ============================================================ */
  /* Split title chars AFTER initial language is set */
  splitTitleChars();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    updateParallelogram();
    updateCharFloat();
  }, { passive: true });

  updateNav();
  updateParallelogram();

})();
