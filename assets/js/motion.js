/* =============================================================
   motion.js — Choreography animation bằng GSAP + ScrollTrigger + Lenis
   Preloader • Hero timeline • Scroll scrub • Split text • Scramble
   ============================================================= */
(function (window, document) {
  'use strict';

  var Motion = (window.Motion = window.Motion || {});
  var Core = window.Core || {};
  var $ = Core.$ || function (s, c) { return (c || document).querySelector(s); };
  var $$ = Core.$$ || function (s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  };

  var gsap = null;
  var ST = null;
  var hasGsap = false;

  /**
   * Thư viện CDN nạp bất đồng bộ nên phải tra cứu lại ở thời điểm sử dụng,
   * không được cache giá trị lúc module nạp.
   */
  function refreshLibs() {
    gsap = window.gsap;
    ST = window.ScrollTrigger;
    hasGsap = !!(gsap && ST);
    if (hasGsap && window.SplitText) {
      try { gsap.registerPlugin(window.SplitText); } catch (e) {}
    }
    // Đồng bộ trạng thái ra ngoài để các module khác kiểm tra được
    Motion.hasGsap = hasGsap;
    return hasGsap;
  }

  var reduce = !!(window.Vendor && window.Vendor.reducedMotion);

  Motion.hasGsap = hasGsap;
  Motion.lenis = null;

  /* ---------------------------------------------------------------
     TEXT SCRAMBLE — chữ hiện dần từ ký tự ngẫu nhiên
     --------------------------------------------------------------- */
  var CHARS = '!<>-_\\/[]{}—=+*^?#________ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  Motion.scramble = function (el, text, opts) {
    if (!el) return;
    opts = opts || {};
    var duration = opts.duration || 1.6;
    var delay = opts.delay || 0;
    var start = performance.now() + delay * 1000;
    var revealed = 0;

    if (reduce) {
      el.textContent = text;
      return;
    }

    function frame(now) {
      var elapsed = now - start;
      if (elapsed < 0) {
        requestAnimationFrame(frame);
        return;
      }
      var progress = Math.min(elapsed / (duration * 1000), 1);
      var count = Math.floor(progress * text.length);

      var out = '';
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (ch === ' ') { out += ' '; continue; }
        if (i < count) {
          out += ch;
        } else if (i < count + 6) {
          out += CHARS[Math.floor(Math.random() * CHARS.length)];
        } else {
          out += ch;
        }
      }
      el.textContent = out;
      revealed = count;

      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = text;
    }
    requestAnimationFrame(frame);
    return revealed;
  };

  /* ---------------------------------------------------------------
     LENIS — smooth scroll đồng bộ ScrollTrigger
     --------------------------------------------------------------- */
  function initLenis() {
    if (!window.Lenis || reduce || !hasGsap) return;
    try {
      var lenis = new window.Lenis({
        duration: 1.15,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true,
        touchMultiplier: 1.6,
      });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      // KHÔNG dùng lagSmoothing(0): frame đầu (compile WebGL + font) nặng
      // vài trăm ms khiến mọi tween nhảy thẳng tới cuối → phần tử kẹt opacity 0.
      gsap.ticker.lagSmoothing(500, 33);
      Motion.lenis = lenis;
    } catch (e) {
      /* ignore */
    }
  }

  /* ---------------------------------------------------------------
     PRELOADER
     --------------------------------------------------------------- */
  Motion.preloader = function (onDone) {
    refreshLibs();
    var pre = $('.preloader');
    if (!pre) {
      if (onDone) onDone();
      return;
    }

    var pct = $('.preloader__pct');
    var bar = $('.preloader__bar span');
    var curtain = $('.preloader__curtain');
    var paths = $$('.preloader__logo path, .preloader__logo line, .preloader__logo polyline, .preloader__logo rect, .preloader__logo circle');

    // Tính chiều dài path để vẽ mượt
    paths.forEach(function (p) {
      try {
        var len = p.getTotalLength ? p.getTotalLength() : 200;
        p.style.setProperty('--len', len);
      } catch (e) {
        p.style.setProperty('--len', 200);
      }
    });

    var counter = { v: 0 };

    function finish() {
      document.body.classList.remove('no-scroll');
      if (pre && pre.parentNode) pre.parentNode.removeChild(pre);
      if (onDone) onDone();
    }

    if (!hasGsap || reduce) {
      // Bản vanilla: ẩn ngay
      if (pre) pre.style.display = 'none';
      finish();
      return;
    }

    document.body.classList.add('no-scroll');

    var tl = gsap.timeline({
      onComplete: function () {
        finish();
      },
    });

    tl.to(counter, {
      v: 100,
      duration: 1.5,
      ease: 'expo.out',
      onUpdate: function () {
        var n = Math.round(counter.v);
        if (pct) pct.textContent = n + '%';
        if (bar) bar.style.width = n + '%';
      },
    })
      .to(
        paths,
        {
          strokeDashoffset: 0,
          duration: 1.25,
          stagger: 0.09,
          ease: 'power2.inOut',
        },
        0.15
      )
      .to(
        '.preloader__label',
        { opacity: 0, y: -12, duration: 0.4, ease: 'power2.in' },
        1.15
      )
      .to(
        '.preloader__inner',
        { opacity: 0, scale: 0.94, duration: 0.45, ease: 'power2.in' },
        1.25
      )
      .to(
        '.preloader__pct, .preloader__logo',
        { opacity: 0, duration: 0.35 },
        1.28
      )
      .to(
        curtain ? curtain.children : [],
        {
          scaleY: 0,
          duration: 0.85,
          stagger: 0.07,
          ease: 'expo.inOut',
        },
        1.42
      );
  };

  /* ---------------------------------------------------------------
     HERO TIMELINE
     --------------------------------------------------------------- */
  function splitWords(el) {
    if (!el) return [];
    if (window.SplitText) {
      try {
        var split = new window.SplitText(el, { type: 'words', wordsClass: 'word' });
        return split.words || [];
      } catch (e) {
        /* fallthrough */
      }
    }
    // Fallback: tự tách từ bằng text node
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    var out = [];
    words.forEach(function (w, i) {
      var span = document.createElement('span');
      span.className = 'word';
      span.textContent = w;
      el.appendChild(span);
      out.push(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return out;
  }

  function heroTimeline() {
    var badge = $('.hero__badge');
    var titleLines = $$('.hero__title .line');
    var words = [];
    titleLines.forEach(function (line) {
      var inner = line.querySelector('.hero__title__inner') || line;
      words = words.concat(splitWords(inner));
    });
    var sub = $('.hero__subtitle');
    var cta = $$('.hero__cta > *');
    var meta = $$('.hero__meta-item');
    var stage = $('.hero__stage');
    var tags = $$('.hero__stage-tag, .hero__stage-hint');
    var hint = $('.scroll-hint');

    var tl = gsap.timeline({ delay: 0.15 });

    if (badge) {
      tl.from(badge, { y: -26, opacity: 0, duration: 0.7, ease: 'back.out(1.7)' });
    }

    if (words.length) {
      tl.from(
        words,
        {
          yPercent: 118,
          rotateX: -92,
          transformOrigin: 'left bottom',
          opacity: 0,
          duration: 1.15,
          stagger: 0.075,
          ease: 'expo.out',
        },
        '-=0.4'
      );
    }

    if (sub) {
      tl.from(
        sub,
        { y: 26, opacity: 0, duration: 0.9, ease: 'power3.out' },
        '-=0.62'
      );
    }

    if (cta.length) {
      tl.from(
        cta,
        {
          y: 34,
          opacity: 0,
          scale: 0.86,
          duration: 0.85,
          stagger: 0.12,
          ease: 'back.out(2.1)',
        },
        '-=0.58'
      );
    }

    if (meta.length) {
      tl.from(
        meta,
        { y: 22, opacity: 0, duration: 0.7, stagger: 0.09, ease: 'power2.out' },
        '-=0.5'
      );
    }

    if (stage) {
      tl.from(
        stage,
        { scale: 0.86, opacity: 0, rotateY: -22, duration: 1.3, ease: 'expo.out' },
        '-=0.95'
      );
    }

    if (tags.length) {
      tl.from(
        tags,
        { scale: 0.7, opacity: 0, duration: 0.6, stagger: 0.11, ease: 'back.out(2)' },
        '-=0.72'
      );
    }

    if (hint) {
      tl.from(hint, { opacity: 0, y: 16, duration: 0.6 }, '-=0.3');
    }

    return tl;
  }

  /* ---------------------------------------------------------------
     SCROLL CHOREOGRAPHY
     --------------------------------------------------------------- */
  function initScrollTriggers() {
    /* --- Progress bar --- */
    var bar = $('.progress-bar');
    if (bar) {
      gsap.to(bar, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
      });
    }

    /* --- Parallax nhiều lầy --- */
    $$('[data-parallax]').forEach(function (el) {
      var depth = parseFloat(el.getAttribute('data-parallax')) || 0.2;
      gsap.to(el, {
        yPercent: -depth * 100,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('section') || el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    });

    /* --- Reveal chung --- */
    var revealEls = $$('[data-reveal]');
    revealEls.forEach(function (el) {
      var kind = el.getAttribute('data-reveal');
      var delay = parseFloat(el.getAttribute('data-reveal-delay')) || 0;
      var from = { opacity: 0, duration: 1, ease: 'power3.out', delay: delay };

      if (kind === 'left') from.x = -60;
      else if (kind === 'right') from.x = 60;
      else if (kind === 'zoom') from.scale = 0.86;
      else if (kind === 'flip') { from.rotateX = 24; from.perspective = 900; }
      else from.y = 46;

      gsap.from(el, {
        ...from,
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      });
    });

    /* --- Cứu an toàn: phần tử đã lọt vào khung nhìn phải nhìn thấy được ---
       gsap.from() khoá opacity:0 ngay từ đầu. Nếu ScrollTrigger không kịp
       kích hoạt (font load lệch layout, tab chạy nền, GSAP lag) phần tử sẽ
       "tàng hình" vĩnh viễn. Ta dùng IntersectionObserver làm lưới an toàn:
       element vào khung nhìn → chờ 1.6s → nếu vẫn tàng hình thì gỡ hết. */
    function safeReveal(els) {
      if (!els || !els.length) return;
      if (!('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          io.unobserve(el);
          window.setTimeout(function () {
            var cs = window.getComputedStyle(el);
            var op = parseFloat(cs.opacity);
            if (!isNaN(op) && op < 0.05) {
              gsap.set(el, { clearProps: 'opacity,transform,visibility' });
              el.style.opacity = '1';
              el.style.visibility = 'visible';
            }
          }, 1600);
        });
      }, { threshold: 0.01 });
      els.forEach(function (el) { io.observe(el); });
    }

    safeReveal(revealEls);
    safeReveal($$('[data-stagger] > *'));
    safeReveal($$('.mat-chip'));
    safeReveal($$('.message__quote span'));
    safeReveal($$('.step'));

    /* --- Stagger cho nhóm card --- */
    $$('[data-stagger]').forEach(function (group) {
      var kids = group.children;
      if (!kids.length) return;
      gsap.from(kids, {
        y: 52,
        opacity: 0,
        rotateX: -14,
        duration: 0.95,
        stagger: 0.09,
        ease: 'power3.out',
        scrollTrigger: { trigger: group, start: 'top 84%', toggleActions: 'play none none none' },
      });
    });

    /* --- Timeline 6 bước: node bật sáng dần --- */
    var stepsTrack = $('.steps__track');
    var steps = $$('.step');
    if (stepsTrack && steps.length) {
      gsap.to(steps, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.14,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: stepsTrack,
          start: 'top 72%',
          end: 'bottom 62%',
          scrub: 0.6,
        },
      });

      /* --- Vạch tiến trình vẽ dần theo scroll --- */
      var stepsProgress = $('.steps__progress');
      if (stepsProgress) {
        gsap.fromTo(
          stepsProgress,
          { width: '0%' },
          {
            width: '84%',
            ease: 'none',
            scrollTrigger: {
              trigger: stepsTrack,
              start: 'top 72%',
              end: 'bottom 62%',
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          }
        );
      }

      /* --- Node phát sáng khi tới --- */
      $$('.step__dot').forEach(function (dot, i) {
        gsap.fromTo(
          dot,
          { scale: 0.82, boxShadow: '0 0 0px rgba(0,0,0,0)' },
          {
            scale: 1,
            boxShadow: '0 0 18px color-mix(in srgb, var(--accent) 70%, transparent)',
            duration: 0.45,
            ease: 'back.out(2)',
            scrollTrigger: { trigger: dot, start: 'top 88%', toggleActions: 'play none none none' },
          }
        );
      });
    }

    /* --- Đường nối diagram --- */
    var wire = $('.arch__wire-line');
    if (wire) {
      gsap.fromTo(
        wire,
        { backgroundPositionX: 0 },
        {
          backgroundPositionX: 28,
          ease: 'none',
          scrollTrigger: { trigger: '.arch', start: 'top 70%', end: 'bottom 60%', scrub: 1 },
        }
      );
    }

    /* --- Section "Vật liệu": chips xếp hình 3D --- */
    var chips = $$('.mat-chip');
    if (chips.length) {
      chips.forEach(function (chip, i) {
        gsap.fromTo(
          chip,
          { y: 60 + i * 8, opacity: 0, rotateX: -30, z: -160 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            z: 0,
            duration: 1,
            ease: 'expo.out',
            scrollTrigger: { trigger: chip, start: 'top 90%', toggleActions: 'play none none none' },
          }
        );
      });
    }

    /* --- Section "Tính năng": cuộn ngang (pin + scrub) --- */
    var featTrack = $('#features-track');
    var featViewport = $('.features__viewport');
    if (featTrack && featViewport && !Core.isTouch) {
      var getScrollAmount = function () {
        return Math.max(0, featTrack.scrollWidth - featViewport.offsetWidth);
      };
      var amount = getScrollAmount();

      // Nếu không tràn ngang (màn hình rộng) thì không cần pin
      if (amount > 40) {
        gsap.to(featTrack, {
          x: function () { return -getScrollAmount(); },
          ease: 'none',
          scrollTrigger: {
            trigger: '.features',
            start: 'top top',
            end: function () { return '+=' + getScrollAmount(); },
            scrub: 0.8,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
      }
    }

    /* --- Marquee: dừng khi hover --- */
    var marqueeTrack = $('.marquee__track');
    if (marqueeTrack) {
      var mq = gsap.to(marqueeTrack, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
      var marquee = $('.marquee');
      if (marquee) {
        marquee.addEventListener('mouseenter', function () { gsap.to(mq, { timeScale: 0.12, duration: 0.4 }); });
        marquee.addEventListener('mouseleave', function () { gsap.to(mq, { timeScale: 1, duration: 0.5 }); });
      }
    }

    /* --- Thông điệp: từng dòng + hào quang --- */
    var msgLines = $$('.message__quote span');
    if (msgLines.length) {
      gsap.from(msgLines, {
        y: 60,
        opacity: 0,
        rotateX: -35,
        duration: 0.95,
        stagger: 0.07,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.message', start: 'top 70%', toggleActions: 'play none none none' },
      });
    }

    /* --- Điều khiển zoom camera 3D theo scroll --- */
    if (window.House3D) {
      gsap.to(
        {},
        {
          scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
            onUpdate: function (self) {
              window.House3D.setZoom(1 + self.progress * 0.42);
            },
          },
        }
      );
    }

    /* --- Nav ẩn khi cuộn xuống --- */
    var nav = $('.nav');
    if (nav) {
      var lastY = 0;
      var navTl = gsap.timeline({ paused: true });
      navTl.to(nav, { yPercent: -100, duration: 0.35, ease: 'power2.inOut' });
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: function (self) {
          var y = self.scroll();
          if (y > 420 && y > lastY + 3) navTl.play();
          else if (y < lastY - 3 || y < 180) navTl.reverse();
          lastY = y;
        },
      });
    }
  }

  /* ---------------------------------------------------------------
     TILT 3D THEO CON TRỎ (fisheye)
     --------------------------------------------------------------- */
  function initTilt() {
    if (Core.isTouch || reduce) return;
    $$('[data-tilt]').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-tilt')) || 8;
      var rx = 0, ry = 0, trx = 0, try_ = 0;
      var raf = null;

      function loop() {
        rx += (trx - rx) * 0.12;
        ry += (try_ - ry) * 0.12;
        el.style.transform =
          'perspective(1000px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateZ(0)';
        if (Math.abs(trx - rx) > 0.02 || Math.abs(try_ - ry) > 0.02) {
          raf = requestAnimationFrame(loop);
        } else {
          raf = null;
        }
      }
      function start() { if (!raf) raf = requestAnimationFrame(loop); }

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        trx = -py * strength;
        try_ = px * strength;
        start();
      });
      el.addEventListener('mouseleave', function () {
        trx = 0;
        try_ = 0;
        start();
      });
    });
  }

  /* ---------------------------------------------------------------
     KHỞI ĐỘNG
     --------------------------------------------------------------- */
  Motion.init = function () {
    refreshLibs();

    if (!hasGsap || reduce) {
      // Bản vanilla: chỉ chạy scramble + tilt nhẹ
      var scr = $('.hero__subtitle .scramble');
      if (scr && scr.getAttribute('data-text')) {
        Motion.scramble(scr, scr.getAttribute('data-text'), { duration: 1.4 });
      }
      initTilt();
      return;
    }

    initLenis();
    heroTimeline();
    initScrollTriggers();
    initTilt();

    // Scramble tagline sau khi hero vào
    var scr = $('.hero__subtitle .scramble');
    if (scr && scr.getAttribute('data-text')) {
      gsap.delayedCall(1.1, function () {
        Motion.scramble(scr, scr.getAttribute('data-text'), { duration: 1.5 });
      });
    }

    // Refresh sau khi ảnh/layout ổn định
    window.addEventListener('load', function () {
      ST.refresh();
    });
    setTimeout(function () { ST.refresh(); }, 600);

    /* Font tải xong mới refresh: Google Fonts (Baloo 2 / Be Vietnam Pro) gây
       layout shift SAU load → mọi start:'top 88%' tính trên layout cũ →
       phần tử tàng hình ở vị trí sai. */
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () {
        ST.refresh();
        if (Motion.lenis) {
          try { Motion.lenis.resize(); } catch (e) {}
        }
      });
    }

    /* Lenis cần biết chiều cao mới sau khi font đổi kích thước dòng */
    if (Motion.lenis) {
      var lenisResizeTimer = null;
      var scheduleLenisResize = function () {
        if (lenisResizeTimer) window.clearTimeout(lenisResizeTimer);
        lenisResizeTimer = window.setTimeout(function () {
          try { Motion.lenis.resize(); } catch (e) {}
        }, 120);
      };
      window.addEventListener('resize', scheduleLenisResize);
      if (window.ResizeObserver) {
        try {
          var ro = new ResizeObserver(scheduleLenisResize);
          ro.observe(document.body);
        } catch (e) {}
      }
    }
  };
})(window, document);
