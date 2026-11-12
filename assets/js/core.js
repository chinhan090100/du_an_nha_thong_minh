/* =============================================================
   core.js — Engine dùng chung cho toàn site
   Theme • Cursor • Reveal • Scroll progress • Magnetic • Transition
   ============================================================= */
(function (window, document) {
  'use strict';

  var Core = (window.Core = window.Core || {});
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch =
    'ontouchstart' in window ||
    (navigator.maxTouchPoints || 0) > 0;

  /* ---------------------------------------------------------------
     PHÂN BIỆT "CÓ CHUỘT" vs "CÓ MÀN CẢM ỨNG"

     BUG NGUYÊN NHÂN: laptop Windows có màn hình cảm ứng có
     navigator.maxTouchPoints = 10 → isTouch = true NGAY CẢ KHI
     người dùng đang cầm chuột. Kết quả mọi hiệu ứng hover/chuột
     bị tắt im lặng (tilt, magnetic, cursor, glow con trỏ, pin cuộn
     ngang) → Chrome PC "chết" hiệu ứng, trong khi Chrome mobile
     vẫn hiện vì animation scroll không bị gate.

     Sửa: dùng media query pointer để biết con trỏ CHÍNH XÁC có
     phải chuột không. hasFinePointer = true trên laptop cảm ứng
     (vẫn có chuột), false trên tablet/mobile thuần.
     --------------------------------------------------------------- */
  var finePointerQuery =
    window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)');
  var hasFinePointer = finePointerQuery ? finePointerQuery.matches : !isTouch;

  Core.reduce = reduce;
  Core.isTouch = isTouch;
  Core.hasFinePointer = hasFinePointer;
  Core.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  Core.lerp = function (a, b, t) { return a + (b - a) * t; };
  Core.$ = function (s, c) { return (c || document).querySelector(s); };
  Core.$$ = function (s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  };

  /* ---------------------------------------------------------------
     1. THEME (light / dark)
     --------------------------------------------------------------- */
  var THEME_KEY = 'nht-theme';

  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function storeTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }

  function preferredTheme() {
    var stored = getStoredTheme();
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#08111d' : '#f6f9fb');
    }
    document.dispatchEvent(
      new CustomEvent('themechange', { detail: { theme: theme } })
    );
  }

  Core.setTheme = function (theme) {
    applyTheme(theme);
    storeTheme(theme);
  };

  Core.initTheme = function () {
    applyTheme(preferredTheme());
    var btn = Core.$('.theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next =
        document.documentElement.getAttribute('data-theme') === 'dark'
          ? 'light'
          : 'dark';
      Core.setTheme(next);
    });
  };

  /* ---------------------------------------------------------------
     2. CUSTOM CURSOR
     --------------------------------------------------------------- */
  Core.initCursor = function () {
    /* Con trỏ tùy biến là phản hồi trực tiếp cho chuột → giữ khi reduce
       (chỉ tắt các chuyển động TỰ ĐỘNG). */
    if (!Core.hasFinePointer) return;
    var dot = Core.$('.cursor-dot');
    var ring = Core.$('.cursor-ring');
    if (!dot || !ring) return;

    var mouseX = window.innerWidth / 2;
    var mouseY = window.innerHeight / 2;
    var dotX = mouseX;
    var dotY = mouseY;
    var ringX = mouseX;
    var ringY = mouseY;

    document.addEventListener(
      'mousemove',
      function (e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        dot.style.opacity = '1';
        ring.style.opacity = '1';
      },
      { passive: true }
    );

    document.addEventListener('mouseleave', function () {
      dot.classList.add('is-hidden');
      ring.classList.add('is-hidden');
    });
    document.addEventListener('mouseenter', function () {
      dot.classList.remove('is-hidden');
      ring.classList.remove('is-hidden');
    });

    var HOVERABLE =
      'a, button, .mat-chip, .goal-card, .feature-card, .req__item, .faq__q, input, textarea, [data-cursor-hover]';

    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest(HOVERABLE)) {
        ring.classList.add('is-hover');
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest(HOVERABLE)) {
        ring.classList.remove('is-hover');
      }
    });

    var cursorRaf = null;
    function cursorLoop() {
      cursorRaf = null;
      dotX = Core.lerp(dotX, mouseX, 0.32);
      dotY = Core.lerp(dotY, mouseY, 0.32);
      ringX = Core.lerp(ringX, mouseX, 0.16);
      ringY = Core.lerp(ringY, mouseY, 0.16);
      dot.style.transform = 'translate(-50%,-50%) translate(' + dotX + 'px,' + dotY + 'px)';
      ring.style.transform = 'translate(-50%,-50%) translate(' + ringX + 'px,' + ringY + 'px)';
      /* Chỉ chạy tiếp khi chuột còn di chuyển — đứng yên thì dừng hẳn,
         trước đây loop 60fps vĩnh viễn kể cả khi không chạm chuột. */
      var moving = Math.abs(mouseX - dotX) > 0.1 || Math.abs(mouseY - dotY) > 0.1 ||
                   Math.abs(mouseX - ringX) > 0.1 || Math.abs(mouseY - ringY) > 0.1;
      if (moving && !document.hidden) cursorRaf = requestAnimationFrame(cursorLoop);
    }

    /* Đánh thức loop khi chuột di chuyển */
    document.addEventListener('mousemove', function () {
      if (!cursorRaf && !document.hidden) cursorRaf = requestAnimationFrame(cursorLoop);
    }, { passive: true });
    cursorRaf = requestAnimationFrame(cursorLoop);
  };

  /* ---------------------------------------------------------------
     3. REVEAL (vanilla fallback — GSAP sẽ thay thế nếu có)
     --------------------------------------------------------------- */
  Core.initReveal = function () {
    var items = Core.$$('[data-reveal]');
    if (!items.length) return;

    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    items.forEach(function (el, i) {
      var d = el.getAttribute('data-reveal-delay');
      if (!d) {
        var parent = el.parentElement;
        var idx = parent ? Array.prototype.indexOf.call(parent.children, el) : i;
        d = Math.min(idx, 8) * 0.08;
      }
      el.style.setProperty('--reveal-delay', d + 's');
      io.observe(el);
    });
  };

  /* ---------------------------------------------------------------
     4. SCROLL PROGRESS + NAV STATE
     --------------------------------------------------------------- */
  Core.initScroll = function () {
    var bar = Core.$('.progress-bar');
    var nav = Core.$('.nav');
    var lastY = window.scrollY;
    var ticking = false;

    function update() {
      var y = window.scrollY;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var p = docH > 0 ? Core.clamp(y / docH, 0, 1) : 0;

      if (bar) {
        if (window.gsap && window.ScrollTrigger && !reduce) {
          /* để GSAP quản lý */
        } else {
          bar.style.transform = 'scaleX(' + p + ')';
        }
      }

      if (nav) {
        nav.classList.toggle('is-scrolled', y > 24);
        if (y > 420 && y > lastY + 4) {
          nav.classList.add('is-hidden');
        } else if (y < lastY - 4 || y < 200) {
          nav.classList.remove('is-hidden');
        }
      }
      lastY = y;
      ticking = false;
    }

    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    update();
  };

  /* ---------------------------------------------------------------
     5. MAGNETIC BUTTONS
     --------------------------------------------------------------- */
  Core.initMagnetic = function () {
    /* Magnetic button là phản hồi hover chủ động → giữ khi reduce. */
    if (!Core.hasFinePointer) return;
    var els = Core.$$('[data-magnetic]');
    els.forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-magnetic')) || 0.32;
      var raf = null;
      var tx = 0, ty = 0, cx = 0, cy = 0;

      function loop() {
        cx = Core.lerp(cx, tx, 0.18);
        cy = Core.lerp(cy, ty, 0.18);
        el.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
          raf = requestAnimationFrame(loop);
        } else {
          raf = null;
        }
      }

      function start() { if (!raf) raf = requestAnimationFrame(loop); }

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * strength;
        ty = (e.clientY - (r.top + r.height / 2)) * strength;
        start();
      });
      el.addEventListener('mouseleave', function () {
        tx = 0;
        ty = 0;
        start();
      });
    });
  };

  /* ---------------------------------------------------------------
     6. PAGE TRANSITION
     --------------------------------------------------------------- */
  Core.initTransition = function () {
    var overlay = Core.$('.page-transition');
    if (!overlay || reduce) return;
    var busy = false;

    Core.transitionTo = function (url) {
      if (busy) return;
      busy = true;
      overlay.classList.add('is-active');
      setTimeout(function () {
        window.location.href = url;
      }, 620);
    };

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-transition]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href === '#' || a.target === '_blank') return;
      if (href.charAt(0) === '#') return;
      e.preventDefault();
      Core.transitionTo(href);
    });

    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        overlay.classList.remove('is-active');
        busy = false;
      }
    });
  };

  /* ---------------------------------------------------------------
     7. SMOOTH ANCHOR SCROLL
     --------------------------------------------------------------- */
  Core.initAnchors = function () {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    });
  };

  /* ---------------------------------------------------------------
     8. NAV BURGER
     --------------------------------------------------------------- */
  Core.initNav = function () {
    var burger = Core.$('.nav__burger');
    var links = Core.$('.nav__links');
    if (!burger || !links) return;

    burger.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        links.classList.remove('is-open');
        burger.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  };

  /* ---------------------------------------------------------------
     9. KHỞI TẠO
     --------------------------------------------------------------- */
  Core.boot = function () {
    Core.initTheme();
    Core.initNav();
    Core.initScroll();
    Core.initAnchors();
    Core.initTransition();
    Core.initCursor();
    Core.initReveal();
    Core.initMagnetic();
  };

  /* Cập nhật hasFinePointer khi user cắm/rút chuột, tablet với PC */
  if (finePointerQuery && finePointerQuery.addEventListener) {
    finePointerQuery.addEventListener('change', function (e) {
      Core.hasFinePointer = e.matches;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Core.boot);
  } else {
    Core.boot();
  }
})(window, document);
