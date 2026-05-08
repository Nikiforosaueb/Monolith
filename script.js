/* ============================================================
   script.js — Monolith Architects
   ─────────────────────────────────────────────────────────────
   This file handles ALL interactive behaviour on the site.
   It is wrapped in an IIFE (function that runs immediately) so
   that all variables here are private and cannot leak into the
   global browser window scope.

   SECTIONS:
     1. Intersection Observer  → reveals sections as you scroll
     2. Navigation             → frosted-glass effect on scroll
     3. Character Float        → the "zero-gravity" title animation
     4. Language Switcher      → EL / EN toggle
     5. Scroll Handler         → RAF-throttled scroll loop
     6. Contact Form           → client-side UX
     7. Smooth Scrolling       → animated anchor navigation
     8. Init                   → startup sequence
   ============================================================ */

(function () {
  'use strict'; // Strict mode catches common JS mistakes early

  /* ── Utilities ──────────────────────────────────────────────
     Shorthand helpers so we don't have to type
     document.querySelector() and document.querySelectorAll()
     every single time. ctx defaults to the whole document.     */
  const qs  = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ── DOM Element References ─────────────────────────────────
     Grab all the elements we'll need throughout this file.
     We do this once at the top so we're not searching the DOM
     repeatedly on every scroll event.                         */
  const nav            = qs('#main-nav');         // The fixed navigation bar
  const sections       = qsa('.section');         // All three page sections
  const introSection   = qs('#intro');            // Section 1: hero / landing
  const philoSection   = qs('#philosophy');       // Section 2: philosophy + services
  const contactSection = qs('#contact');          // Section 3: contact + footer
  const form           = qs('#contact-form');     // The enquiry form
  const formSuccess    = qs('#form-success');     // The success message (hidden by default)
  const langBtns       = qsa('.lang-btn');        // ΕΛ / EN buttons in the nav

  /* ── State Variables ────────────────────────────────────────
     Small pieces of state we track throughout the session.    */
  let currentLang = 'el';   // Currently active language ('el' or 'en')
  let ticking     = false;  // RAF throttle flag (prevents too many scroll calls)

  /* ============================================================
     1. INTERSECTION OBSERVER — Section Reveals
     ─────────────────────────────────────────────────────────
     The browser's built-in IntersectionObserver watches each
     section. When a section becomes 12% visible on screen, it
     gets the 'in-view' class added. CSS transitions then play
     automatically — elements slide in, fade in, etc.

     This is much more performant than listening to scroll
     events for this purpose.
     ============================================================ */
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Section is at least 12% visible — trigger its animations
          entry.target.classList.add('in-view');
        }
        // Note: we intentionally do NOT remove 'in-view' on exit,
        // so animations only play once (on first appearance).
      });
    },
    { threshold: 0.12 } // Fire when 12% of the section is visible
  );

  // Start observing all three sections
  sections.forEach((sec) => sectionObserver.observe(sec));

  /* ============================================================
     2. NAVIGATION — Scroll-aware frosted glass effect
     ─────────────────────────────────────────────────────────
     When the user scrolls more than 40px, the nav bar gets
     the 'nav--scrolled' class. CSS applies a blurred, semi-
     transparent background (frosted glass / backdrop-filter).
     When scrolled back to the top, it becomes transparent again.
     ============================================================ */
  function updateNav() {
    if (window.scrollY > 40) {
      nav.classList.add('nav--scrolled');    // Apply frosted glass
    } else {
      nav.classList.remove('nav--scrolled'); // Back to transparent
    }
  }

  /* ============================================================
     3. ZERO-GRAVITY CHARACTER FLOAT ANIMATION
     ─────────────────────────────────────────────────────────
     This is the main visual effect of the site. As the user
     scrolls down past the intro section, each letter of
     "MONOLITH" and "ARCHITECTS" floats away independently.

     HOW IT WORKS:
       Step A) splitTitleChars() — wraps every letter in its own
               <span class="char"> so each can be moved separately.
               Each char gets random "personality" values.

       Step B) updateCharFloat() — called on every scroll event.
               Reads how far the user has scrolled past the intro
               and moves each char accordingly using CSS transform.

     DIRECTION:
       - "MONOLITH"   (lineIndex 0) → floats UP   (negative Y)
       - "ARCHITECTS" (lineIndex 1) → floats DOWN  (positive Y)
     ============================================================ */

  /* Stores the random parameters for every character.
     Indexed in the same order as the .char elements in the DOM. */
  const charParams = [];

  /* Deterministic pseudo-random number generator.
     Given the same seed, always returns the same value (0–1).
     We use the character's position as the seed so that
     refreshing the page doesn't change the animation. */
  function pseudoRandom(seed) {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x); // Returns fractional part only (0–0.999...)
  }

  /* Step A: Split each title line's text into individual <span> elements.
     Also assigns random personality values to each character.
     Called once on page load and again when language changes. */
  function splitTitleChars() {
    const lines = qsa('.title-line'); // [0] = "MONOLITH", [1] = "ARCHITECTS"
    let globalIdx = 0; // Counts across both lines for unique seeding

    lines.forEach((line, lineIdx) => {
      const text = line.textContent; // Get the word (e.g. "MONOLITH")
      line.textContent = ''; // Clear the element — we'll repopulate it
      line.setAttribute('aria-label', text); // Keep text readable for screen readers

      // Loop through each character in the word
      [...text].forEach((ch, chIdx) => {
        const span = document.createElement('span');
        span.className   = 'char';
        // Use non-breaking space for actual spaces so layout is preserved
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        // These styles enable GPU-accelerated transforms
        span.style.display            = 'inline-block';
        span.style.willChange         = 'transform, opacity, filter';
        span.style.backfaceVisibility = 'hidden';

        /* Assign random personality — each char behaves slightly differently */
        const r = pseudoRandom(globalIdx * 7 + lineIdx * 31); // Unique seed per char
        charParams.push({
          speedMult: 0.85 + r * 1.0,                            // How fast it moves (0.85× – 1.85×)
          driftX:    (pseudoRandom(globalIdx * 13 + 5) - 0.5) * 60, // Sideways drift ±30px
          delayFrac: (globalIdx / 20) * 0.06,                   // Stagger delay (chars don't all start together)
          rotateDeg: (pseudoRandom(globalIdx * 17 + 3) - 0.5) * 20, // Rotation ±10°
          lineIndex: lineIdx, // 0 = MONOLITH (floats UP), 1 = ARCHITECTS (floats DOWN)
        });

        line.appendChild(span); // Add the letter span back into the title line
        globalIdx++;
      });
    });
  }

  /* Step B: Calculate and apply transforms to each character based on scroll.
     Called on every scroll tick via requestAnimationFrame. */
  function updateCharFloat() {
    if (!introSection) return; // Safety check

    const rect = introSection.getBoundingClientRect();
    const vh   = window.innerHeight;

    /* Calculate how far the intro has scrolled off the top of the screen.
       progress = 0 when intro is fully visible.
       progress = 1 when intro has scrolled completely away.
       The 1.1× multiplier means the animation finishes just before the
       intro fully exits, so the transition feels natural. */
    const rawProg  = Math.max(0, (-rect.top / vh) * 1.1);
    const progress = Math.min(1, rawProg); // Clamp to [0, 1]

    const chars = qsa('.char'); // All individual letter spans

    chars.forEach((span, i) => {
      const p = charParams[i];
      if (!p) return; // Safety check (e.g. during language switch)

      /* Each character starts its animation at a slightly different scroll position.
         This creates the staggered "blown away" effect. */
      const localProg = Math.max(0, Math.min(1,
        (progress - p.delayFrac * 0.4) * 1.4 * p.speedMult
      ));

      if (localProg <= 0) {
        // Not yet floating — reset to original CSS position
        span.style.transform = '';
        span.style.opacity   = '';
        span.style.filter    = '';
        return;
      }

      /* Apply ease-in-out curve to the progress value.
         Raw progress is linear; easing makes it start slow,
         accelerate in the middle, then slow at the end. */
      const eased = localProg < 0.5
        ? 2 * localProg * localProg          // Ease in (accelerate)
        : -1 + (4 - 2 * localProg) * localProg; // Ease out (decelerate)

      /* DIRECTION: MONOLITH goes up (-1), ARCHITECTS goes down (+1) */
      const direction = p.lineIndex === 1 ? 1 : -1;
      const floatY    = direction * eased * 420 * p.speedMult; // Max 420px travel

      /* Sideways drift — gives "blown by wind" feeling */
      const driftX = eased * p.driftX;

      /* Gentle rotation as it floats */
      const rotate = eased * p.rotateDeg;

      /* Opacity: full opacity at start, then quickly fades after 10% */
      const opacity = localProg < 0.1
        ? 1
        : Math.max(0, 1 - ((localProg - 0.1) / 0.5));

      /* Blur: kicks in after 40% — chars become defocused as they drift away */
      const blur = localProg > 0.4
        ? (localProg - 0.4) / 0.6 * 5 // Ramps up to 5px blur
        : 0;

      // Apply all transforms in one CSS transform string (most performant)
      span.style.transform = `translateY(${floatY}px) translateX(${driftX}px) rotate(${rotate}deg)`;
      span.style.opacity   = opacity;
      span.style.filter    = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : '';
    });

    /* The supporting elements (label, statement, scroll hint, right strip)
       also float upward, but more slowly and with less travel (300px max).
       They start slightly after the main title chars begin moving. */
    const floatEls = [
      { el: qs('.intro-label'),       centered: false }, // "Αρχιτεκτονικό Γραφείο" label
      { el: qs('.intro-statement'),    centered: false }, // The italic statement paragraph
      { el: qs('.intro-scroll-hint'), centered: false }, // The scroll line at bottom-left
      { el: qs('.intro-right-strip'), centered: true  }, // Right strip (needs -50% preserve)
    ];

    floatEls.forEach(({ el, centered }, i) => {
      if (!el) return;
      // Each element starts slightly later (i * 0.015 offset)
      const localP = Math.max(0, Math.min(1, (progress - 0.02 - i * 0.015) * 2.0));
      const eased  = localP < 0.5
        ? 2 * localP * localP
        : -1 + (4 - 2 * localP) * localP;
      const floatY  = -eased * 300; // All support elements go UP
      const opacity = localP < 0.08 ? 1 : Math.max(0, 1 - ((localP - 0.08) / 0.5));

      /* The right strip uses transform: translateY(-50%) in CSS for centering.
         We must preserve that -50% offset when adding our scroll-driven Y. */
      el.style.transform = centered
        ? `translateY(calc(-50% + ${floatY}px))`
        : `translateY(${floatY}px)`;
      el.style.opacity = opacity;
    });
  }

  /* ============================================================
     5. SCROLL HANDLER — RAF-throttled
     ─────────────────────────────────────────────────────────
     The scroll event fires MANY times per second (potentially
     hundreds). Running heavy code on every single fire would
     make the page janky. Instead we use requestAnimationFrame:
     we set a "ticking" flag, and only run our updates once per
     animation frame (max 60fps). This is the industry-standard
     pattern for performant scroll handling.
     ============================================================ */
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateNav();        // Check if nav needs frosted glass
        updateCharFloat();  // Update the title character positions
        ticking = false;    // Allow the next scroll event to queue again
      });
      ticking = true; // Block further queuing until this frame runs
    }
  }

  /* ============================================================
     6. LANGUAGE SWITCHER
     ─────────────────────────────────────────────────────────
     Supports: ΕΛ (Greek) and EN (English).

     Every piece of text in the HTML has data-el and data-en
     attributes with the translated content. When a language
     button is clicked, applyLanguage() scans the entire DOM
     and swaps all the text at once.

     The chosen language is saved in localStorage so it persists
     across page visits. On first visit, the browser language is
     auto-detected.
     ============================================================ */

  /* The font family to use for each language */
  const langFonts = {
    el: "'Syne', system-ui, sans-serif",
    en: "'Syne', system-ui, sans-serif",
  };

  /* Text direction: left-to-right for both our current languages */
  const langDir = {
    el: 'ltr',
    en: 'ltr',
  };

  /* The standard HTML lang attribute value for each language */
  const langCode = {
    el: 'el',
    en: 'en',
  };

  /* Main function: applies a language to the entire page */
  function applyLanguage(lang) {
    currentLang = lang;
    const body = document.body;
    const html = document.documentElement;
    const key  = `data-${lang}`; // e.g. "data-el" or "data-en"

    /* Update the <html> element's lang and dir attributes
       (important for accessibility and browser behaviour) */
    html.setAttribute('lang', langCode[lang]);
    html.setAttribute('dir', langDir[lang]);
    body.style.direction = langDir[lang];

    /* Switch the body font family */
    body.style.fontFamily = langFonts[lang];

    /* Remove any language-specific body classes (kept for future use) */
    body.classList.toggle('lang-he', lang === 'he');
    body.classList.toggle('lang-zh', lang === 'zh');

    /* Find every element that has a data-el or data-en attribute
       and update its text content to the new language */
    qsa(`[${key}]`).forEach((el) => {
      // Title lines are handled separately (they need char re-splitting)
      if (el.classList.contains('title-line')) return;
      const text = el.getAttribute(key);
      if (text) {
        // Some translations contain HTML (like <br> or <em>)
        if (text.includes('<')) {
          el.innerHTML = text; // Safe here — content is ours
        } else {
          el.textContent = text;
        }
      }
    });

    /* Special handling for title lines:
       We need to set the text first, then re-run splitTitleChars()
       to re-wrap each character in its own <span> for the float animation */
    qsa('.title-line').forEach((line) => {
      const newText = line.getAttribute(key);
      if (newText && !newText.includes('<')) {
        line.textContent = newText; // Restore plain text
        charParams.length = 0;     // Clear the old char params array
      }
    });
    // Re-split if any title line no longer has .char children
    if (qsa('.title-line').some(l => !l.querySelector('.char'))) {
      splitTitleChars();
    }

    /* Update placeholder text in inputs and textareas
       (placeholder can't be set via textContent, needs its own attribute) */
    qsa(`[data-placeholder-${lang}]`).forEach((el) => {
      el.placeholder = el.getAttribute(`data-placeholder-${lang}`);
    });

    /* Update the text of <option> elements inside <select> dropdowns */
    qsa('select option[data-el]').forEach((opt) => {
      const optText = opt.getAttribute(key);
      if (optText) opt.textContent = optText;
    });

    /* Visually highlight the active language button in the nav */
    langBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    /* RTL adjustments for the philosophy body text border
       (kept for potential future use if Hebrew is re-added) */
    const philoBody = qs('.philosophy-body');
    if (philoBody && lang === 'he') {
      philoBody.style.borderLeft   = 'none';
      philoBody.style.borderRight  = '2px solid var(--clr-accent)';
      philoBody.style.paddingLeft  = '0';
      philoBody.style.paddingRight = '20px';
      philoBody.style.textAlign    = 'right';
    } else if (philoBody) {
      philoBody.style.borderLeft   = '2px solid var(--clr-accent)';
      philoBody.style.borderRight  = 'none';
      philoBody.style.paddingLeft  = '20px';
      philoBody.style.paddingRight = '0';
      philoBody.style.textAlign    = '';
    }

    /* Letter-spacing fix for non-Latin scripts */
    const labels = qsa('.form-label');
    if (lang === 'zh' || lang === 'he') {
      labels.forEach((l) => l.style.letterSpacing = '0.05em');
    } else {
      labels.forEach((l) => l.style.letterSpacing = '');
    }

    /* Save the user's language preference to localStorage
       so it's remembered when they come back to the site */
    try { localStorage.setItem('monolith-lang', lang); } catch(e) {}

    /* Update the mobile dropdown trigger text (shows current language code) */
    const _mCode   = qs('#mobile-lang-code');
    const _codemap = { el: 'ΕΛ', en: 'EN' };
    if (_mCode && _codemap[lang]) _mCode.textContent = _codemap[lang];

    /* Highlight the active option in the mobile dropdown */
    qsa('.mobile-lang-option').forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });
  }

  /* Wire up click events on the desktop ΕΛ / EN buttons */
  langBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang; // e.g. 'el' or 'en'
      if (lang !== currentLang) {    // Only switch if different language
        applyLanguage(lang);
      }
    });
  });

  /* ── Mobile Language Dropdown ───────────────────────────────
     On small screens the desktop buttons are hidden.
     Instead there's a single button that opens a dropdown menu. */
  const mobileTrigger  = qs('#mobile-lang-trigger');
  const mobileDropdown = qs('#mobile-lang-dropdown');
  const mobileOptions  = qsa('.mobile-lang-option');

  /* Hide the dropdown (remove 'open' class, update ARIA attributes) */
  function closeMobileDropdown() {
    if (!mobileDropdown) return;
    mobileDropdown.classList.remove('open');
    mobileDropdown.setAttribute('aria-hidden', 'true');
    if (mobileTrigger) mobileTrigger.setAttribute('aria-expanded', 'false');
  }

  /* Show the dropdown */
  function openMobileDropdown() {
    if (!mobileDropdown) return;
    mobileDropdown.classList.add('open');
    mobileDropdown.setAttribute('aria-hidden', 'false');
    if (mobileTrigger) mobileTrigger.setAttribute('aria-expanded', 'true');
  }

  /* Toggle dropdown open/closed when trigger button is tapped */
  if (mobileTrigger) {
    mobileTrigger.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent this click from also triggering "click outside" close
      const isOpen = mobileDropdown.classList.contains('open');
      isOpen ? closeMobileDropdown() : openMobileDropdown();
    });
  }

  /* Apply language and close dropdown when a mobile option is tapped */
  mobileOptions.forEach((opt) => {
    opt.addEventListener('click', () => {
      const lang = opt.dataset.lang;
      applyLanguage(lang);
      closeMobileDropdown();
    });
  });

  /* Close the mobile dropdown if the user clicks anywhere else on the page */
  document.addEventListener('click', (e) => {
    if (mobileDropdown && !mobileDropdown.contains(e.target) && e.target !== mobileTrigger) {
      closeMobileDropdown();
    }
  });

  /* On page load: restore saved language preference or auto-detect */
  (function restoreLang() {
    try {
      // Check if the user has a saved preference from a previous visit
      const saved = localStorage.getItem('monolith-lang');
      if (saved && ['el', 'en', 'zh', 'he'].includes(saved)) {
        applyLanguage(saved);
        return; // Done — no need to auto-detect
      }
    } catch(e) {} // localStorage may be blocked in some browsers

    /* Auto-detect from browser language setting */
    const navLang    = window.navigator;
    const browserLang = (navLang.language || navLang.userLanguage || 'el').toLowerCase();
    if (browserLang.startsWith('en')) applyLanguage('en'); // English browser → EN
    else applyLanguage('el'); // Default to Greek
  })();

  /* ============================================================
     7. CONTACT FORM — Client-side UX
     ─────────────────────────────────────────────────────────
     The form uses novalidate so we control validation ourselves.
     On submit, we show a loading state, then fade the form out
     and fade in a success message.

     NOTE: This does not actually send an email — it is purely
     a visual simulation. To send real emails, you would need a
     server-side form handler (e.g. Formspree, Netlify Forms).
     ============================================================ */
  if (form) {
    /* Track when inputs have been filled — used for CSS styling */
    const inputs = qsa('.form-input, .form-textarea, .form-select', form);
    inputs.forEach((input) => {
      input.addEventListener('blur', () => {
        // Add 'has-value' class when the field has content (for styling)
        input.classList.toggle('has-value', !!input.value.trim());
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault(); // Stop the browser from doing a full page reload

      const submitBtn  = qs('#form-submit-btn');
      const submitText = qs('.submit-text', submitBtn);

      /* Step 1: Disable button and show loading dots */
      submitBtn.disabled = true;
      submitText.textContent = '...';

      /* Step 2: After 800ms, fade out the form */
      setTimeout(() => {
        form.style.opacity    = '0';
        form.style.transition = 'opacity 0.4s ease';

        /* Step 3: After the fade, hide form and show success message */
        setTimeout(() => {
          form.style.display = 'none';
          formSuccess.classList.add('visible');
          applyLanguage(currentLang); // Translate the success message
        }, 400); // 400ms = matches the opacity transition duration
      }, 800);
    });
  }

  /* ============================================================
     8. SMOOTH ANCHOR SCROLLING
     ─────────────────────────────────────────────────────────
     When clicking nav links like "#philosophy" or "#contact",
     instead of the page jumping instantly, it smoothly scrolls
     to the target section. We intercept the default link
     behaviour and use scrollIntoView with behavior: 'smooth'.
     ============================================================ */
  qsa('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = qs(anchor.getAttribute('href')); // Find the target section
      if (target) {
        e.preventDefault(); // Stop the default instant-jump
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ============================================================
     9. INIT — Startup Sequence
     ─────────────────────────────────────────────────────────
     Everything above is just function definitions. This is
     where we actually start things running.
     ============================================================ */

  /* Split title chars AFTER language is applied (restoreLang runs above) */
  splitTitleChars();

  /* Listen for scroll — passive:true tells the browser we won't call
     preventDefault(), allowing it to scroll without waiting for us */
  window.addEventListener('scroll', onScroll, { passive: true });

  /* On window resize, recalculate character positions */
  window.addEventListener('resize', () => {
    updateCharFloat();
  }, { passive: true });

  /* Run nav check immediately on load (in case page reloads mid-scroll) */
  updateNav();

})(); // ← End of IIFE — everything inside stays private
