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
     TYPEWRITER — chữ gõ máy từng ký tự, caret nhấp nháy
     --------------------------------------------------------------- */
  Motion.scramble = function (el, text, opts) {
    if (!el) return;
    opts = opts || {};
    var duration = opts.duration || 1.6;
    var delay = opts.delay || 0;
    text = text || el.getAttribute('data-text') || el.textContent || '';

    if (reduce) {
      el.textContent = text;
      return;
    }
    /* Tránh chạy 2 lần (boot rescue + preloader) gây nháy chữ */
    if (el.getAttribute('data-typed') === '1') return;
    el.setAttribute('data-typed', '1');

    /* Giữ chỗ phần chưa gõ bằng ký tự tàng hình (nbsp) để không co giãn
       layout và không hiện chấm "·" gây bẩn chữ. */
    var HIDDEN = ' ';

    var start = performance.now() + delay * 1000;
    var caret = document.createElement('span');
    caret.className = 'type-caret';
    caret.setAttribute('aria-hidden', 'true');

    function frame(now) {
      var elapsed = now - start;
      if (elapsed < 0) {
        requestAnimationFrame(frame);
        return;
      }
      var progress = Math.min(elapsed / (duration * 1000), 1);
      var count = Math.floor(progress * text.length);

      /* Gõ máy: chỉ hiện ký tự đã gõ + caret, phần chưa gõ giữ chỗ
         bằng ký tự tàng hình để không co giãn layout, không bẩn chữ */
      var typed = text.slice(0, count);
      var rest = text.slice(count).replace(/[^\s]/g, HIDDEN);
      el.textContent = typed + rest;
      el.appendChild(caret);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = text;
        if (caret.parentNode) caret.parentNode.removeChild(caret);
      }
    }
    requestAnimationFrame(frame);
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
    var showcase = $('.hero__showcase');
    var cards = $$('.hero__card');
    var chips = $$('.hero__chip');
    var hint = $('.scroll-hint');

    var tl = gsap.timeline({ delay: 0.15 });

    /* ---------------------------------------------------------------
       CHẾ ĐỘ GIẢM CHUYỂN ĐỘNG (prefers-reduced-motion: reduce)

       Người dùng bật "Animation effects" = Off trong Windows → Chrome
       báo reduce. Trước đây Motion.init() bail-out hoàn toàn khiến
       trang đứng hình, tệ hơn cả lúc không có animation. Nay ta vẫn
       cho nội dung xuất hiện, chỉ bỏ chuyển động LỚN (dịch, xoay,
       scale) và giữ lại fade — an toàn cho người mắc chóng mặt.
       --------------------------------------------------------------- */
    if (reduce) {
      if (badge) tl.from(badge, { opacity: 0, duration: 0.4 }, 0);
      if (words.length) tl.from(words, { opacity: 0, duration: 0.5, stagger: 0.04 }, 0);
      if (sub) tl.from(sub, { opacity: 0, duration: 0.5 }, 0.1);
      if (cta.length) tl.from(cta, { opacity: 0, duration: 0.5, stagger: 0.06 }, 0.15);
      if (meta.length) tl.from(meta, { opacity: 0, duration: 0.5, stagger: 0.05 }, 0.2);
      if (showcase) tl.from(showcase, { opacity: 0, duration: 0.7 }, 0.1);
      if (cards.length) tl.from(cards, { opacity: 0, duration: 0.5, stagger: 0.05 }, 0.2);
      if (chips.length) tl.from(chips, { opacity: 0, duration: 0.5, stagger: 0.05 }, 0.25);
      if (hint) tl.from(hint, { opacity: 0, duration: 0.4 }, 0.3);
      return tl;
    }

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

    if (showcase) {
      tl.from(
        showcase,
        { opacity: 0, duration: 0.9, ease: 'power2.out' },
        '-=1.05'
      );
    }

    if (cards.length) {
      tl.from(
        cards,
        {
          y: 46,
          opacity: 0,
          scale: 0.9,
          duration: 1.05,
          stagger: 0.12,
          ease: 'expo.out',
        },
        '-=0.85'
      );
    }

    if (chips.length) {
      tl.from(
        chips,
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

    /* --- Parallax nhiều lầy --- (tắt khi giảm chuyển động) --- */
    if (!reduce) {
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
    }

    /* --- Reveal chung --- */
    var revealEls = $$('[data-reveal]');
    revealEls.forEach(function (el) {
      var kind = el.getAttribute('data-reveal');
      var delay = parseFloat(el.getAttribute('data-reveal-delay')) || 0;
      var from = { opacity: 0, duration: 1, ease: 'power3.out', delay: delay };

      /* reduce → chỉ fade, KHÔNG translate/rotate/scale */
      if (!reduce) {
        if (kind === 'left') from.x = -60;
        else if (kind === 'right') from.x = 60;
        else if (kind === 'zoom') from.scale = 0.86;
        else if (kind === 'flip') { from.rotateX = 24; from.perspective = 900; }
        else from.y = 46;
      }

      gsap.from(el, {
        ...from,
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      });
    });

    /* --- Cứu an toàn: phần tử đã lọt vào khung nhìn phải nhìn thấy được ---
       gsap.from() khoá opacity:0 ngay từ đầu. Nếu ScrollTrigger không kịp
       kích hoạt (font load lệch layout, tab chạy nền, GSAP lag) phần tử sẽ
       "tàng hình" vĩnh viễn. Ta dùng IntersectionObserver làm lưới an toàn:
       element vào khung nhìn → chờ 1.6s → nếu vẫn tàng hình thì gỡ hết.

       Mạng lưới phủ rộng: mọi phần tử có thể bị gsap.from() đặt opacity:0
       đều phải có lưới an toàn, nếu không sẽ xuất hiện lỗi "nội dung biến
       mất" trên một số thiết bị. */
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
      return io;
    }

    var SAFE_SELECTORS = [
      '[data-reveal]',
      '[data-stagger] > *',
      '.mat-chip',
      '.message__quote span',
      '.step',
      '.goal-card',
      '.feature-card',
      '.faq__item',
      '.stat',
      '.req__item',
      '.illus-shot',
      '.arch__node',
      '.marquee__item',
    ];

    function collectSafeEls() {
      var out = [];
      SAFE_SELECTORS.forEach(function (sel) {
        $$(sel).forEach(function (el) {
          if (out.indexOf(el) === -1) out.push(el);
        });
      });
      return out;
    }

    safeReveal(collectSafeEls());

    /* --- Watchdog toàn cục ---
       Quét mỗi 3s: element đang hiện trong khung nhìn nhưng opacity < 0.05
       → buộc hiện. Đây là lưới an toàn cuối cùng cho mọi trường hợp
       (GSAP lag, tab nền, layout đổi đột ngột, ảnh lazy-load). */
    function forceRevealStuck() {
      var vh = window.innerHeight || 800;
      var vw = window.innerWidth || 1200;
      var nodes = document.querySelectorAll(
        '[data-reveal], [data-stagger] > *, .goal-card, .feature-card, .faq__item, ' +
        '.stat, .req__item, .illus-shot, .arch__node, .mat-chip, .step'
      );
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
        if (r.width === 0 && r.height === 0) continue;
        var op = parseFloat(window.getComputedStyle(el).opacity);
        if (!isNaN(op) && op < 0.05) {
          gsap.set(el, { clearProps: 'opacity,transform,visibility' });
          el.style.opacity = '1';
          el.style.visibility = 'visible';
        }
      }
    }
    window.setInterval(forceRevealStuck, 3000);

    /* --- Refresh sau khi ảnh lazy-load xong ---
       .illus-shot dùng loading="lazy": chiều cao ảnh thay đổi sau khi
       tải → ScrollTrigger tính sai vị trí → phần tử tàng hình. */
    var gallery = $('.illus-gallery');
    if (gallery && window.ResizeObserver) {
      try {
        var galleryRO = new ResizeObserver(function () {
          ST.refresh();
        });
        galleryRO.observe(gallery);
      } catch (e) {}
    }
    $$('img[loading="lazy"]').forEach(function (img) {
      if (!img.complete) {
        img.addEventListener('load', function () {
          ST.refresh();
        }, { once: true });
        img.addEventListener('error', function () {
          ST.refresh();
        }, { once: true });
      }
    });

    /* --- Stagger cho nhóm card --- */
    $$('[data-stagger]').forEach(function (group) {
      var kids = group.children;
      if (!kids.length) return;
      var vars = reduce
        ? { opacity: 0, duration: 0.7, stagger: 0.05, ease: 'power2.out' }
        : {
            y: 52,
            opacity: 0,
            rotateX: -14,
            duration: 0.95,
            stagger: 0.09,
            ease: 'power3.out',
          };
      gsap.from(kids, {
        ...vars,
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
        if (reduce) {
          gsap.from(chip, {
            opacity: 0,
            duration: 0.6,
            scrollTrigger: { trigger: chip, start: 'top 90%', toggleActions: 'play none none none' },
          });
          return;
        }
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

    /* --- Section "Tính năng": cuộn ngang (pin + scrub) ---
       KHÔNG gate theo isTouch: laptop cảm ứng vẫn dùng chuột,
       hiệu ứng này phải chạy trên mọi desktop. Chỉ bỏ qua khi
       người dùng yêu cầu giảm chuyển động. */
    var featTrack = $('#features-track');
    var featViewport = $('.features__viewport');
    if (featTrack && featViewport && !reduce) {
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

    /* --- Marquee: dừng khi hover --- (tắt vòng lặp vô hạn khi reduce) --- */
    var marqueeTrack = $('.marquee__track');
    if (marqueeTrack && !reduce) {
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
      if (reduce) {
        gsap.from(msgLines, {
          opacity: 0,
          duration: 0.7,
          stagger: 0.05,
          scrollTrigger: { trigger: '.message', start: 'top 70%', toggleActions: 'play none none none' },
        });
      } else {
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
    /* Tilt là tương tác HOVER do người dùng chủ động (không phải chuyển
       động tự động) → vẫn cho phép khi reduce. Chỉ cần có chuột thật. */
    if (!Core.hasFinePointer) return;
    $$('[data-tilt]').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-tilt')) || 8;

      /* Dùng gsap.quickTo để GSAP tự hợp nhất transform với các
         tween khác đang ghi cùng thuộc tính (vd. [data-stagger] > *
         dùng rotateX). Viết thẳng el.style.transform sẽ đè lên
         GSAP → phần tử nhấp nháy / giật. */
      var rotX = null;
      var rotY = null;
      if (window.gsap) {
        rotX = gsap.quickTo(el, 'rotationX', { duration: 0.45, ease: 'power3.out' });
        rotY = gsap.quickTo(el, 'rotationY', { duration: 0.45, ease: 'power3.out' });
      }

      var trx = 0;
      var try_ = 0;

      function apply() {
        if (rotX && rotY) {
          rotX(trx);
          rotY(try_);
          return;
        }
        // Fallback vanilla (không có GSAP)
        el.style.transform =
          'perspective(1000px) rotateX(' + trx.toFixed(2) + 'deg) rotateY(' +
          try_.toFixed(2) + 'deg) translateZ(0)';
      }

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        trx = -py * strength;
        try_ = px * strength;
        apply();
      });
      el.addEventListener('mouseleave', function () {
        trx = 0;
        try_ = 0;
        apply();
      });
    });
  }

  /* ---------------------------------------------------------------
     KHỞI ĐỘNG
     --------------------------------------------------------------- */
  Motion.init = function () {
    refreshLibs();

    if (!hasGsap) {
      // Bản vanilla: chỉ chạy scramble + tilt nhẹ
      var scr = $('.hero__subtitle .scramble');
      if (scr && scr.getAttribute('data-text')) {
        Motion.scramble(scr, scr.getAttribute('data-text'), { duration: 1.4 });
      }
      initTilt();
      return;
    }

    /* ---------------------------------------------------------------
       prefers-reduced-motion: KHÔNG bail-out.

       Trước đây `if (!hasGsap || reduce) return;` khiến trang đứng
       hình hoàn toàn khi Windows tắt "Animation effects" — nội dung
       vẫn còn opacity:0 từ CSS/JS nên có thể bị tàng hình.

       Nay: vẫn chạy GSAP nhưng chỉ với FADE (xem các nhánh `reduce`
       bên trong heroTimeline / initScrollTriggers), tắt parallax, pin
       cuộn ngang, xoay 3D, float loop, Lenis smooth-scroll.
       --------------------------------------------------------------- */
    if (!reduce) {
      initLenis();
    }
    heroTimeline();
    initScrollTriggers();
    initTilt();

    // Scramble tagline sau khi hero vào (bỏ qua khi giảm chuyển động)
    var scr = $('.hero__subtitle .scramble');
    if (!reduce && scr && scr.getAttribute('data-text')) {
      gsap.delayedCall(0.4, function () {
        Motion.scramble(scr, scr.getAttribute('data-text'), { duration: 1.8 });
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
