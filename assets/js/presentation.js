/* =============================================================
   presentation.js — Slide controller 3D (GSAP enhanced)
   Navigate • Keyboard • Swipe • Rail • Overview • Fullscreen • Hash
   Morph tiêu đề giữa các slide • Lớp chiều sâu nổi lên/xuống
   Parallax chuột • Card tilt 3D + specular glare
   ============================================================= */
(function (window, document) {
  'use strict';

  var Pres = (window.Pres = window.Pres || {});
  var Core = window.Core || {};
  var $ = Core.$ || function (s, c) { return (c || document).querySelector(s); };
  var $$ = Core.$$ || function (s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  };

  var reduce = !!(window.Vendor && window.Vendor.reducedMotion);
  var isTouch = !!(window.Vendor && window.Vendor.isTouch);
  /* Chuột thật hay chỉ màn hình cảm ứng? (laptop cảm ứng vẫn có chuột) */
  var hasFinePointer =
    window.Vendor && window.Vendor.hasFinePointer !== undefined
      ? window.Vendor.hasFinePointer
      : !isTouch;

  var st = {
    index: 0,
    total: 0,
    slides: [],
    busy: false,
    gsap: null,
    hasGsap: false,
    started: false,
  };

  var DUR = {
    out: 0.58,
    in: 0.8,
    morphOut: 0.4,
    morphIn: 0.68,
    reveal: 0.7,
  };

  /* ---------------------------------------------------------------
     TIỆN ÍCH
     --------------------------------------------------------------- */
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function depthOf(el) {
    var raw = el.getAttribute && el.getAttribute('data-depth');
    var d = raw === null || raw === undefined ? 0.5 : parseFloat(raw);
    if (isNaN(d)) d = 0.5;
    return clamp(d, 0, 1);
  }

  /* ---------------------------------------------------------------
     KHỞI TẠO
     --------------------------------------------------------------- */
  Pres.init = function () {
    st.slides = $$('.p-slide');
    st.total = st.slides.length;
    if (!st.total) return;

    // Bọc nội dung slide vào lớp cuộn riêng để giữ preserve-3d ở .p-slide__inner
    st.slides.forEach(wrapBody);

    buildRail();
    buildDots();
    buildOverview();
    bindNav();
    bindKeyboard();
    bindSwipe();
    bindHash();

    var startIdx = hashIndex();
    goTo(startIdx, true);
  };

  /* ---------------------------------------------------------------
     BỌC NỘI DUNG SLIDE VÀO LỚP CUỘN RIÊNG
     (giữ .p-slide__inner không overflow → không phá preserve-3d)
     --------------------------------------------------------------- */
  function wrapBody(slide) {
    var inner = $('.p-slide__inner', slide);
    if (!inner) return;
    if ($('.p-slide__body', inner)) return;

    var body = document.createElement('div');
    body.className = 'p-slide__body';

    while (inner.firstChild) body.appendChild(inner.firstChild);
    inner.appendChild(body);

    // Gán biến chiều sâu cho các phần tử có data-depth
    $$('[data-depth]', body).forEach(function (el, i) {
      var d = parseFloat(el.getAttribute('data-depth')) || 0.5;
      el.style.setProperty('--d', d);
      el.style.setProperty('--depth-delay', (i % 6) * 0.28);
    });
  }

  /* ---------------------------------------------------------------
     CHUYỂN SLIDE
     --------------------------------------------------------------- */
  function goTo(index, instant) {
    if (st.busy) return;
    index = Math.max(0, Math.min(st.total - 1, index));
    if (index === st.index && !instant) return;

    var prev = st.slides[st.index];
    var next = st.slides[index];
    var forward = index > st.index;

    st.busy = true;
    st.index = index;

    updateUI();
    setHash(index);

    if (instant) {
      applyInstant(next);
      st.busy = false;
      return;
    }

    if (st.hasGsap) gsapGoTo(prev, next, forward);
    else cssGoTo(prev, next, forward);
  }

  function next() { goTo(st.index + 1); }
  function prev() { goTo(st.index - 1); }

  function applyInstant(slide) {
    slide.classList.remove('is-exit-left', 'is-exit-right');
    slide.setAttribute('aria-hidden', 'false');
    slide.classList.add('is-active');

    if (st.hasGsap) {
      slide.style.opacity = '1';
      slide.style.visibility = 'visible';
      st.gsap.set(slide, {
        opacity: 1, rotationY: 0, rotationX: 0, z: 0, scale: 1,
        filter: 'none', clipPath: 'inset(0% 0% 0% 0%)',
      });
      revealContent(slide, 0);
    } else {
      // Fallback CSS: để class .is-active điều khiển hiển thị,
      // xoá inline style cũ để không kẹt slide ở trạng thái "hiện".
      slide.style.opacity = '';
      slide.style.visibility = '';
    }
  }

  /* ---------------------------------------------------------------
     NHÁNH 1 — KHÔNG CÓ GSAP (fallback CSS)
     --------------------------------------------------------------- */
  function cssGoTo(prev, next, forward) {
    prev.classList.remove('is-active');
    prev.classList.add(forward ? 'is-exit-left' : 'is-exit-right');
    prev.setAttribute('aria-hidden', 'true');

    // Xoá inline style do GSAP/nhánh trước để lại (nếu có) để class
    // .is-active / .is-exit-* trở lại quyền điều khiển hiển thị.
    prev.style.opacity = '';
    prev.style.visibility = '';

    next.classList.remove('is-exit-left', 'is-exit-right');
    next.setAttribute('aria-hidden', 'false');
    next.style.opacity = '';
    next.style.visibility = '';
    void next.offsetWidth;
    next.classList.add('is-active');

    var items = $$('[data-s]', next);
    items.forEach(function (el, i) {
      el.style.setProperty('--sd', i * 0.07 + 0.12 + 's');
    });

    setTimeout(function () {
      prev.classList.remove('is-exit-left', 'is-exit-right');
      st.busy = false;
    }, reduce ? 40 : 700);
  }

  /* ---------------------------------------------------------------
     NHÁNH 2 — GSAP TIMELINE 3D
     --------------------------------------------------------------- */
  function gsapGoTo(prev, next, forward) {
    var gsap = st.gsap;
    var dir = forward ? 1 : -1;

    // 1) Tiêu đề cũ "cuộn" ra — morph đầu vào
    morphOut(prev);

    // 2) Slide cũ: xoay + lùi xa + blur
    gsap.set(prev, { zIndex: 3, opacity: 1, visibility: 'visible' });
    prev.classList.remove('is-active');
    prev.classList.add('is-leaving');
    prev.setAttribute('aria-hidden', 'true');
    if (reduce) {
      /* Giảm chuyển động → chỉ fade, không xoay/lùi/blur */
      gsap.to(prev, {
        opacity: 0,
        duration: 0.28,
        ease: 'power2.inOut',
        onComplete: function () {
          prev.classList.remove('is-leaving', 'is-exit-left', 'is-exit-right');
          gsap.set(prev, {
            filter: 'none',
            clipPath: 'inset(0% 0% 0% 0%)',
            visibility: 'hidden',
            zIndex: 1,
          });
        },
      });
    } else {
      gsap.to(prev, {
        rotationY: -34 * dir,
        rotationX: 4 * dir,
        z: -560,
        scale: 0.84,
        opacity: 0,
        filter: 'blur(14px)',
        duration: DUR.out,
        ease: 'power3.inOut',
        onComplete: function () {
          prev.classList.remove('is-leaving', 'is-exit-left', 'is-exit-right');
          gsap.set(prev, {
            filter: 'none',
            clipPath: 'inset(0% 0% 0% 0%)',
            visibility: 'hidden',
            zIndex: 1,
          });
        },
      });
    }

    // 3) Slide mới: shutter wipe + mờ từ xa
    next.classList.remove('is-exit-left', 'is-exit-right');
    next.setAttribute('aria-hidden', 'false');
    next.classList.add('is-active');

    if (reduce) {
      gsap.set(next, {
        zIndex: 2,
        opacity: 1,
        visibility: 'visible',
        rotationY: 0,
        rotationX: 0,
        z: 0,
        scale: 1,
        filter: 'none',
        clipPath: 'inset(0% 0% 0% 0%)',
      });
    } else {
      gsap.set(next, {
        zIndex: 2,
        opacity: 1,
        visibility: 'visible',
        rotationY: 12 * dir,
        rotationX: -3 * dir,
        z: -260,
        scale: 0.9,
        filter: 'blur(16px)',
        clipPath: 'inset(0% 0% 100% 0%)',
      });
      gsap.to(next, {
        rotationY: 0,
        rotationX: 0,
        z: 0,
        scale: 1,
        filter: 'blur(0px)',
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: DUR.in,
        ease: 'expo.out',
      });
    }

    // 4) Nội dung nổi lên theo tầng chiều sâu
    revealContent(next, DUR.in * 0.36);

    // 5) Tiêu đề mới "cuộn" vào — morph đầu ra
    morphIn(next, DUR.in * 0.34);

    // 6) Hiệu ứng riêng theo slide (đếm số, ánh sáng loé bìa, Ken Burns)
    slideEnterFx(next, DUR.in * 0.5);

    setTimeout(function () {
      st.busy = false;
    }, reduce ? 60 : DUR.in * 1000 + 40);
  }

  /* ---------------------------------------------------------------
     HIỆU ỨNG KHI VÀO SLIDE
     --------------------------------------------------------------- */
  function slideEnterFx(slide, delay) {
    if (!st.hasGsap || !slide) return;
    var gsap = st.gsap;

    /* Số liệu & thanh biểu đồ chỉ chạy khi vào slide (không chạy sẵn).
       Vẫn chạy khi reduce vì đếm số là thông tin, không phải chuyển động lớn. */
    animateStats(slide, reduce ? 0 : delay);

    /* Ánh sáng loé trên tiêu đề bìa — bỏ qua khi giảm chuyển động */
    if (!reduce && slide.querySelector('.p-cover__title')) {
      gsap.delayedCall(delay + 0.15, function () {
        playCoverGlare();
      });
    }
  }

  /* ---------------------------------------------------------------
     MORPH TIÊU ĐỀ — cuộn từng từ/ký tự theo chiều 3D
     --------------------------------------------------------------- */
  var MORPH_SEL = [
    '.p-eyebrow',
    '.p-title',
    '.p-cover__title',
    '.p-quote__text',
    '.p-cover__title span',
    '.p-quote__text span',
  ];

  function isMorphTarget(el) {
    if (!el || !el.matches) return false;
    return el.matches(MORPH_SEL);
  }

  /* Tách phần tử thành các đơn vị có thể animate riêng */
  function splitMorph(el) {
    if (el.__morphParts) return el.__morphParts;

    // Không tách phần tử gradient — sẽ hỏng hiệu ứng background-clip: text
    if (el.classList && el.classList.contains('p-grad')) {
      el.__morphParts = [el];
      return el.__morphParts;
    }

    var parts = [];
    var nodes = Array.prototype.slice.call(el.childNodes);

    nodes.forEach(function (node) {
      if (node.nodeType === 3) {
        var text = node.textContent;
        if (!text.trim()) {
          el.removeChild(node);
          return;
        }
        var span = document.createElement('span');
        span.className = 'p-morph-unit';
        span.textContent = text;
        el.replaceChild(span, node);
        parts.push(span);
      } else if (node.nodeType === 1) {
        node.classList.add('p-morph-unit');
        parts.push(node);
      }
    });

    el.__morphParts = parts;
    return parts;
  }

  function morphOut(slide) {
    if (!st.hasGsap) return;
    var gsap = st.gsap;
    $$('[data-s]', slide).forEach(function (el) {
      if (!isMorphTarget(el)) return;
      var parts = splitMorph(el);
      if (!parts.length) return;
      if (reduce) {
        gsap.to(parts, {
          opacity: 0,
          duration: 0.24,
          stagger: 0.02,
          ease: 'power2.in',
          overwrite: 'auto',
        });
        return;
      }
      gsap.to(parts, {
        y: -46,
        opacity: 0,
        rotationX: 58,
        transformOrigin: '50% 0%',
        duration: DUR.morphOut,
        stagger: 0.035,
        ease: 'power2.in',
        overwrite: 'auto',
      });
    });
  }

  function morphIn(slide, delay) {
    if (!st.hasGsap) return;
    var gsap = st.gsap;
    $$('[data-s]', slide).forEach(function (el) {
      if (!isMorphTarget(el)) return;
      var parts = splitMorph(el);
      if (!parts.length) return;
      if (reduce) {
        gsap.fromTo(
          parts,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.4,
            delay: delay,
            stagger: 0.03,
            ease: 'power2.out',
            overwrite: 'auto',
          }
        );
        return;
      }
      gsap.fromTo(
        parts,
        { y: 72, opacity: 0, rotationX: -72, transformOrigin: '50% 100%' },
        {
          y: 0,
          opacity: 1,
          rotationX: 0,
          duration: DUR.morphIn,
          delay: delay,
          stagger: 0.055,
          ease: 'expo.out',
          overwrite: 'auto',
        }
      );
    });
  }

  /* ---------------------------------------------------------------
     REVEAL THEO CHIỀU SÂU (3D nổi lên/xuống)
     --------------------------------------------------------------- */
  function revealContent(slide, delay) {
    var gsap = st.gsap;
    var items = $$('[data-s]', slide);
    if (!items.length) return;

    if (!st.hasGsap) {
      items.forEach(function (el, i) {
        el.style.setProperty('--sd', i * 0.07 + 0.12 + 's');
      });
      return;
    }

    // Chỉ reveal các phần tử KHÔNG phải morph target (morph target đã có timeline riêng)
    var list = items.filter(function (el) { return !isMorphTarget(el); });

    // Sắp xếp theo chiều sâu: lớp nông (gần) hiện trước
    var sorted = list.slice().sort(function (a, b) {
      return depthOf(b) - depthOf(a);
    });

    sorted.forEach(function (el, i) {
      var d = depthOf(el);
      var fromVars;
      var toVars;

      if (reduce) {
        /* Giảm chuyển động → chỉ fade, không bay 3D */
        fromVars = { opacity: 0 };
        toVars = { opacity: 1 };
      } else {
        var z = -190 * (1 - d);
        var y = 46 + 34 * (1 - d);
        var rotX = -11 * (1 - d);
        var rotY = 6 * (1 - d);
        fromVars = { opacity: 0, y: y, z: z, rotationX: rotX, rotationY: rotY, scale: 0.965 };
        toVars = { opacity: 1, y: 0, z: 0, rotationX: 0, rotationY: 0, scale: 1 };
      }

      gsap.fromTo(
        el,
        fromVars,
        {
          ...toVars,
          duration: DUR.reveal,
          delay: (delay || 0) + i * 0.055,
          ease: 'expo.out',
          overwrite: 'auto',
          // Bảo đảm phần tử luôn hiện đủ dù khung hình bị chậm
          onUpdate: function () {
            if (this.progress() >= 1) el.style.opacity = '1';
          },
        }
      );
    });
  }

  /* ---------------------------------------------------------------
     FLOAT LOOP — 3D nổi lên xuống liên tục
     --------------------------------------------------------------- */
  var FLOAT_SEL = '.p-card__icon, .p-tl__num, .p-flow__hub, .p-eyebrow, .p-cover__badge, .p-stat';

  function bindFloats() {
    if (reduce || !st.hasGsap) return;
    $$('.p-slide').forEach(function (slide) {
      $$(FLOAT_SEL, slide).forEach(function (el) {
        if (el.__floatBound) return;
        el.__floatBound = true;
        var amp = el.classList.contains('p-eyebrow') || el.classList.contains('p-cover__badge') ? 3 : 5;
        var dur = 2.6 + Math.random() * 1.4;
        st.gsap.to(el, {
          yPercent: -amp,
          duration: dur,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: Math.random() * 1.2,
          overwrite: false,
        });
      });
    });
  }

  /* ---------------------------------------------------------------
     PARALLAX CHUỘT
     --------------------------------------------------------------- */
  function bindParallax() {
    /* Parallax là chuyển động TỰ ĐỘNG theo scroll → tắt khi reduce. */
    if (reduce || !hasFinePointer || !st.hasGsap) return;
    var stage = $('.p-stage');
    if (!stage) return;

    var gsap = st.gsap;
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

    function loop() {
      cx = lerp(cx, tx, 0.09);
      cy = lerp(cy, ty, 0.09);
      var slide = st.slides[st.index];
      if (slide) {
        var inner = $('.p-slide__inner', slide);
        if (inner) {
          gsap.set(inner, {
            rotationY: cx * 4.2,
            rotationX: cy * -2.8,
            x: cx * 10,
            y: cy * 6,
          });
        }
      }
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }

    function start() {
      if (!raf) raf = requestAnimationFrame(loop);
    }

    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      tx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      ty = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
      start();
    }, { passive: true });

    stage.addEventListener('pointerleave', function () {
      tx = 0; ty = 0;
      start();
    });
  }

  /* ---------------------------------------------------------------
     CARD TILT 3D + SPECULAR GLARE
     --------------------------------------------------------------- */
  var TILT_SEL = '.p-card, .p-tl, .p-stat, .p-thumb';

  function bindTilt() {
    /* Tilt là tương tác hover chủ động → giữ cả khi reduce. */
    if (!hasFinePointer || !st.hasGsap) return;
    var gsap = st.gsap;

    $$(TILT_SEL).forEach(function (el) {
      if (el.__tiltBound) return;
      el.__tiltBound = true;

      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;

        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');

        gsap.to(el, {
          rotationY: (px - 0.5) * 16,
          rotationX: -(py - 0.5) * 13,
          z: 56,
          duration: 0.42,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      }, { passive: true });

      el.addEventListener('pointerleave', function () {
        gsap.to(el, {
          rotationY: 0,
          rotationX: 0,
          z: 0,
          duration: 0.85,
          ease: 'elastic.out(1, 0.45)',
          overwrite: 'auto',
        });
      });
    });
  }

  /* ---------------------------------------------------------------
     KEN BURNS — ảnh trong slide nhóm chuyển động chậm, sống động
     --------------------------------------------------------------- */
  var KEN_BURNS_SEL = '.p-mosaic__item img, .p-thumb img, .p-shot img';

  function bindKenBurns() {
    if (reduce || !st.hasGsap) return;
    var gsap = st.gsap;
    $$(KEN_BURNS_SEL).forEach(function (img, i) {
      if (img.__kbBound) return;
      img.__kbBound = true;
      gsap.set(img, { scale: 1.02, transformOrigin: '50% 50%' });
      gsap.to(img, {
        scale: 1.13,
        xPercent: i % 2 ? -2.5 : 2.5,
        yPercent: i % 3 ? 1.8 : -1.8,
        duration: 13 + i * 2.5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        overwrite: false,
      });
    });
  }

  /* ---------------------------------------------------------------
     SPECULAR GLARE — ánh sáng loé chạy qua tiêu đề bìa
     --------------------------------------------------------------- */
  function playCoverGlare() {
    if (reduce || !st.hasGsap) return;
    var gsap = st.gsap;
    var title = $('.p-cover__title');
    if (!title) return;

    /* Điều khiển background-position của ::after bằng biến CSS */
    gsap.fromTo(
      title,
      { '--glare-pos': '-30%', '--glare-opacity': 0 },
      {
        '--glare-pos': '130%',
        '--glare-opacity': 1,
        duration: 1.5,
        ease: 'power2.inOut',
        overwrite: 'auto',
      }
    );
    gsap.to(
      title,
      {
        '--glare-opacity': 0,
        duration: 0.9,
        delay: 0.9,
        ease: 'power2.in',
        overwrite: false,
      }
    );
  }

  /* ---------------------------------------------------------------
     SỐ LIỆU & THANH BIỂU ĐỒ (GSAP)
     --------------------------------------------------------------- */
  function animateStats(slide, delay) {
    if (!st.hasGsap) return;
    var gsap = st.gsap;
    var d0 = delay || 0;

    $$('.p-bar__fill', slide).forEach(function (el, i) {
      var raw = el.getAttribute('style') || '';
      var match = /--w:\s*([\d.]+)%/.exec(raw);
      var target = match ? parseFloat(match[1]) : 50;
      gsap.fromTo(el,
        { width: '0%' },
        {
          width: target + '%',
          duration: 1.35,
          delay: d0 + 0.25 + i * 0.1,
          ease: 'expo.out',
          overwrite: 'auto',
        }
      );
    });

    $$('.p-stat__num', slide).forEach(function (el, i) {
      var raw = (el.textContent || '').trim();
      /* Chỉ lấy PHẦN SỐ ở đầu để đếm, giữ nguyên phần hậu tố.
         "30%" → 30 + "%" | "2s" → 2 + "s" | "24/7" → 24 + "/7" | "8+" → 8 + "+" */
      var m = /^(\d+(?:[.,]\d+)?)([\s\S]*)$/.exec(raw);
      if (!m) return;
      var to = parseFloat(m[1].replace(',', '.'));
      var suffix = m[2] || '';
      if (!isFinite(to)) return;
      var obj = { v: 0 };
      gsap.to(obj, {
        v: to,
        duration: 1.5,
        delay: d0 + 0.3 + i * 0.12,
        ease: 'power2.out',
        overwrite: 'auto',
        onUpdate: function () {
          var val = to % 1 ? obj.v.toFixed(1) : String(Math.round(obj.v));
          el.textContent = val + suffix;
        },
      });
    });
  }

  /* ---------------------------------------------------------------
     CẬP NHẬT GIAO DIỆN
     --------------------------------------------------------------- */
  function updateUI() {
    var i = st.index;

    var cur = $('.p-counter__cur');
    var tot = $('.p-counter__total');
    if (cur) cur.textContent = String(i + 1).padStart(2, '0');
    if (tot) tot.textContent = String(st.total).padStart(2, '0');

    var ring = $('.p-ring__fg');
    if (ring) {
      var C = 2 * Math.PI * 20;
      ring.style.strokeDasharray = C;
      ring.style.strokeDashoffset = C - (C * (i + 1)) / st.total;
    }
    var ringTxt = $('.p-ring__txt');
    if (ringTxt) {
      ringTxt.textContent = Math.round(((i + 1) / st.total) * 100) + '%';
    }

    var pbar = $('.p-progress');
    if (pbar) {
      pbar.style.transform = 'scaleX(' + (i + 1) / st.total + ')';
    }

    $$('.p-rail__item').forEach(function (el, idx) {
      el.classList.toggle('is-active', idx === i);
    });

    $$('.p-dots__item').forEach(function (el, idx) {
      el.classList.toggle('is-active', idx === i);
    });

    $$('.p-thumb').forEach(function (el, idx) {
      el.classList.toggle('is-active', idx === i);
    });

    var bPrev = $('.p-nav__btn--prev');
    var bNext = $('.p-nav__btn--next');
    if (bPrev) bPrev.disabled = i === 0;
    if (bNext) bNext.disabled = i === st.total - 1;
  }

  /* ---------------------------------------------------------------
     SECTION RAIL
     --------------------------------------------------------------- */
  function buildRail() {
    var rail = $('.p-rail');
    if (!rail) return;
    rail.innerHTML = '';
    st.slides.forEach(function (slide, i) {
      var label = slide.getAttribute('data-title') || 'Slide ' + (i + 1);
      var btn = document.createElement('button');
      btn.className = 'p-rail__item';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Đến slide ' + (i + 1) + ': ' + label);
      btn.innerHTML =
        '<span class="p-rail__dot"></span>' +
        '<span class="p-rail__label">' + escapeHtml(label) + '</span>';
      btn.addEventListener('click', function () { goTo(i); });
      rail.appendChild(btn);
    });
  }

  /* ---------------------------------------------------------------
     DOTS (mobile)
     --------------------------------------------------------------- */
  function buildDots() {
    var dots = $('.p-dots');
    if (!dots) return;
    dots.innerHTML = '';
    st.slides.forEach(function (s, i) {
      var d = document.createElement('button');
      d.className = 'p-dots__item';
      d.type = 'button';
      d.setAttribute('aria-label', 'Slide ' + (i + 1));
      d.addEventListener('click', function () { goTo(i); });
      dots.appendChild(d);
    });
  }

  /* ---------------------------------------------------------------
     OVERVIEW MODE
     --------------------------------------------------------------- */
  function buildOverview() {
    var grid = $('.p-overview__grid');
    if (!grid) return;
    grid.innerHTML = '';
    st.slides.forEach(function (slide, i) {
      var title = slide.getAttribute('data-title') || 'Slide ' + (i + 1);
      var thumb = document.createElement('button');
      thumb.className = 'p-thumb';
      thumb.type = 'button';
      thumb.innerHTML =
        '<span class="p-thumb__num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="p-thumb__title">' + escapeHtml(title) + '</span>';
      thumb.addEventListener('click', function () {
        closeOverview();
        goTo(i);
      });
      grid.appendChild(thumb);
    });
  }

  function openOverview() {
    var ov = $('.p-overview');
    if (!ov) return;
    ov.classList.add('is-open');
    ov.setAttribute('aria-hidden', 'false');
    var btn = $('.p-icon-btn--overview');
    if (btn) btn.classList.add('is-active');
    updateUI();
    if (st.hasGsap) {
      st.gsap.fromTo(
        '.p-thumb',
        { opacity: 0, y: 26, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.035, ease: 'expo.out' }
      );
    }
  }

  function closeOverview() {
    var ov = $('.p-overview');
    if (!ov) return;
    ov.classList.remove('is-open');
    ov.setAttribute('aria-hidden', 'true');
    var btn = $('.p-icon-btn--overview');
    if (btn) btn.classList.remove('is-active');
  }

  function toggleOverview() {
    var ov = $('.p-overview');
    if (!ov) return;
    if (ov.classList.contains('is-open')) closeOverview();
    else openOverview();
  }

  /* ---------------------------------------------------------------
     NAV BUTTONS
     --------------------------------------------------------------- */
  function bindNav() {
    var bPrev = $('.p-nav__btn--prev');
    var bNext = $('.p-nav__btn--next');
    if (bPrev) bPrev.addEventListener('click', prev);
    if (bNext) bNext.addEventListener('click', next);

    var bOv = $('.p-icon-btn--overview');
    if (bOv) bOv.addEventListener('click', toggleOverview);

    var bClose = $('.p-overview__close');
    if (bClose) bClose.addEventListener('click', closeOverview);

    var bFs = $('.p-icon-btn--fullscreen');
    if (bFs) {
      bFs.addEventListener('click', function () {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen &&
            document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen && document.exitFullscreen();
        }
      });
    }

    var bHome = $('.p-icon-btn--home');
    if (bHome) {
      bHome.addEventListener('click', function () {
        window.location.href = 'index.html';
      });
    }

    var bPrint = $('.p-icon-btn--print');
    if (bPrint) {
      bPrint.addEventListener('click', function () {
        window.print();
      });
    }
  }

  /* ---------------------------------------------------------------
     PHÍM TẮT
     --------------------------------------------------------------- */
  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          e.preventDefault();
          goTo(0);
          break;
        case 'End':
          e.preventDefault();
          goTo(st.total - 1);
          break;
        case 'f':
        case 'F':
          if (document.fullscreenElement) {
            document.exitFullscreen && document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen &&
              document.documentElement.requestFullscreen();
          }
          break;
        case 'o':
        case 'O':
          toggleOverview();
          break;
        case 'Escape':
          closeOverview();
          break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            goTo(parseInt(e.key, 10) - 1);
          }
      }
    });
  }

  /* ---------------------------------------------------------------
     SWIPE (touch + kéo chuột)
     --------------------------------------------------------------- */
  function bindSwipe() {
    var stage = $('.p-stage');
    if (!stage) return;

    var x0 = null, y0 = null, t0 = 0;

    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button, a, input, table')) return;
      x0 = e.clientX;
      y0 = e.clientY;
      t0 = Date.now();
    });

    stage.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0;
      var dy = e.clientY - y0;
      var dt = Date.now() - t0;
      x0 = null;

      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 900) {
        if (dx < 0) next();
        else prev();
      }
    });

    stage.addEventListener('pointercancel', function () { x0 = null; });
  }

  /* ---------------------------------------------------------------
     HASH SYNC
     --------------------------------------------------------------- */
  function setHash(i) {
    var h = '#slide-' + (i + 1);
    if (window.history.replaceState) {
      window.history.replaceState(null, '', h);
    } else {
      window.location.hash = h;
    }
  }

  function hashIndex() {
    var m = /^#slide-(\d+)$/.exec(window.location.hash || '');
    if (!m) return 0;
    return Math.max(0, Math.min(st.total - 1, parseInt(m[1], 10) - 1));
  }

  function bindHash() {
    window.addEventListener('hashchange', function () {
      var i = hashIndex();
      if (i !== st.index) goTo(i);
    });
  }

  /* ---------------------------------------------------------------
     TIỆN ÍCH
     --------------------------------------------------------------- */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------------------------------------------------------------
     PARTICLE BACKGROUND
     --------------------------------------------------------------- */
  function initParticles() {
    var canvas = $('#p-canvas');
    if (!canvas || reduce) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var pts = [];
    var W = 0, H = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var raf = null;

    function resize() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.max(24, Math.min(70, Math.round((W * H) / 26000)));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.7 + 0.6,
        });
      }
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120,200,255,0.5)';
        ctx.fill();
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j];
          var dx = q.x - p.x, dy = q.y - p.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < 118) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = 'rgba(74,222,128,' + (0.18 * (1 - d / 118)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    window.addEventListener('resize', function () {
      clearTimeout(resize._t);
      resize._t = setTimeout(resize, 180);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
      else if (!raf) frame();
    });

    resize();
    frame();
  }

  /* ---------------------------------------------------------------
     BOOT
     --------------------------------------------------------------- */
  function startDeck() {
    if (st.started) return;
    st.started = true;

    st.gsap = window.gsap || null;
    /* ---------------------------------------------------------------
       reduced-motion KHÔNG được tắt GSAP hoàn toàn.
       Nếu tắt, toàn bộ deck rơi về fallback CSS: không morph, không
       depth reveal, không đếm số → "slide phèn" (đúng triệu chứng
       user báo). Nay GSAP vẫn chạy nhưng các nhánh có `reduce`
       sẽ chỉ dùng fade, không translate/rotate/scale lớn.
       --------------------------------------------------------------- */
    st.hasGsap = !!st.gsap;

    if (st.hasGsap) {
      document.documentElement.classList.add('has-gsap');
      st.gsap.defaults({ ease: 'power3.out' });
      // Không cắt animation khi khung hình bị chậm (máy yếu / tab chạy nền).
      // Mặc định GSAP giới hạn delta mỗi frame → tween có thể bị kẹt giữa chừng.
      try { st.gsap.ticker.lagSmoothing(0); } catch (e) { /* ignore */ }
    }

    Pres.init();

    if (st.hasGsap) {
      bindFloats();
      bindParallax();
      bindTilt();
      bindKenBurns();
      /* Slide đầu tiên: hiệu ứng chạy ngay khi deck mở */
      slideEnterFx(st.slides[0], 0.15);
    }
  }

  Pres.boot = function () {
    initParticles();

    if (window.Vendor && window.Vendor.loadMotion) {
      window.Vendor.loadMotion(function () {
        startDeck();
      });
      // Dự phòng: CDN chết → vẫn khởi động deck bằng CSS fallback
      setTimeout(function () {
        startDeck();
      }, 3500);
    } else {
      startDeck();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Pres.boot);
  } else {
    Pres.boot();
  }
})(window, document);
