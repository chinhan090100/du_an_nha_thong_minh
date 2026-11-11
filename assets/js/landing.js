/* =============================================================
   landing.js — Tương tác riêng cho trang giới thiệu
   Particle constellation • Stats counter • Accordion • Marquee
   ============================================================= */
(function (window, document) {
  'use strict';

  var Landing = (window.Landing = window.Landing || {});
  var Core = window.Core || {};
  var $ = Core.$ || function (s, c) { return (c || document).querySelector(s); };
  var $$ = Core.$$ || function (s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  };
  var reduce = !!(window.Vendor && window.Vendor.reducedMotion);
  var isTouch = !!(window.Vendor && window.Vendor.isTouch);
  /* Chuột thật hay chỉ màn hình cảm ứng? (laptop cảm ứng vẫn có chuột) */
  var hasFinePointer = window.Core && window.Core.hasFinePointer !== undefined
    ? window.Core.hasFinePointer
    : (window.Vendor && window.Vendor.hasFinePointer !== undefined
        ? window.Vendor.hasFinePointer
        : !isTouch);

  /* ---------------------------------------------------------------
     1. PARTICLE CONSTELLATION CANVAS
     --------------------------------------------------------------- */
  function initParticles() {
    var canvas = $('#particle-canvas');
    if (!canvas || reduce) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var particles = [];
    var W = 0, H = 0;
    var mouse = { x: -9999, y: -9999 };
    var raf = null;
    var running = false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function palette() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      return dark
        ? { node: '74,222,128', line: '34,211,238' }
        : { node: '34,197,94', line: '56,189,248' };
    }
    var col = palette();

    function count() {
      var area = W * H;
      var base = Math.round(area / 22000);
      return Math.max(26, Math.min(isTouch ? 46 : 92, base));
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      var n = count();
      particles = [];
      for (var i = 0; i < n; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.34,
          vy: (Math.random() - 0.5) * 0.34,
          r: Math.random() * 1.9 + 0.7,
          ox: 0, oy: 0,
        });
      }
    }

    function frame() {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      ctx.clearRect(0, 0, W, H);
      var linkDist = hasFinePointer ? 132 : 96;
      var mouseDist = 190;

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        // Hút nhẹ về con trỏ
        var dx = mouse.x - p.x;
        var dy = mouse.y - p.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < mouseDist * mouseDist && d2 > 0.01) {
          var f = (1 - Math.sqrt(d2) / mouseDist) * 0.055;
          p.x += dx * f;
          p.y += dy * f;
        }

        // Vẽ node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + col.node + ',0.55)';
        ctx.fill();

        // Vẽ dây nối
        for (var j = i + 1; j < particles.length; j++) {
          var q = particles[j];
          var lx = q.x - p.x;
          var ly = q.y - p.y;
          var ld = Math.sqrt(lx * lx + ly * ly);
          if (ld < linkDist) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle =
              'rgba(' + col.line + ',' + (0.22 * (1 - ld / linkDist)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    function start() {
      if (running) return;
      running = true;
      frame();
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    window.addEventListener('resize', function () {
      clearTimeout(resize._t);
      resize._t = setTimeout(resize, 160);
    });

    window.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }, { passive: true });

    window.addEventListener('mouseleave', function () {
      mouse.x = -9999;
      mouse.y = -9999;
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });

    // Đổi màu khi đổi theme
    document.addEventListener('themechange', function () {
      col = palette();
    });

    resize();
    start();
  }

  /* ---------------------------------------------------------------
     2. STATS COUNTER
     --------------------------------------------------------------- */
  function initCounters() {
    var nums = $$('[data-count]');
    if (!nums.length) return;

    function animate(el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var dur = parseFloat(el.getAttribute('data-duration')) || 1.8;
      var suffix = el.getAttribute('data-suffix') || '';
      var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);

      if (reduce) {
        el.textContent = target.toFixed(dec) + suffix;
        return;
      }

      var start = performance.now();
      function frame(now) {
        var p = Math.min((now - start) / (dur * 1000), 1);
        // easeOutExpo
        var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        var val = target * eased;
        el.textContent = val.toFixed(dec) + suffix;
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = target.toFixed(dec) + suffix;
      }
      requestAnimationFrame(frame);
    }

    if (!('IntersectionObserver' in window)) {
      nums.forEach(animate);
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            animate(en.target);
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ---------------------------------------------------------------
     3. ACCORDION FAQ
     --------------------------------------------------------------- */
  function initAccordion() {
    var items = $$('.faq__item');
    if (!items.length) return;

    items.forEach(function (item) {
      var btn = item.querySelector('.faq__q');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');

        // Đóng tất cả (accordion, chỉ 1 mở)
        items.forEach(function (it) {
          it.classList.remove('is-open');
          var b = it.querySelector('.faq__q');
          if (b) b.setAttribute('aria-expanded', 'false');
        });

        if (!isOpen) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---------------------------------------------------------------
     4. MARQUEE — nhân bản nội dung để chạy vô hạn
     --------------------------------------------------------------- */
  function initMarquee() {
    var track = $('.marquee__track');
    if (!track) return;
    // Nhân bản 2 lần để đường chạy liền mạch
    var html = track.innerHTML;
    track.innerHTML = html + html;
  }

  /* ---------------------------------------------------------------
     5. THÊM GÓC GRADIENT THEO CON TRỎ cho card
     --------------------------------------------------------------- */
  function initPointerGlow() {
    /* Glow theo con trỏ = phản hồi chủ động → giữ khi reduce. */
    if (!hasFinePointer) return;
    $$('.goal-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------------------------------------------------------------
     6. HERO 3D — khởi tạo scene
     --------------------------------------------------------------- */
  function initScene() {
    var stage = $('.hero__stage');
    if (!stage || !window.House3D) return;
    window.House3D.init(stage);

    // Đồng bộ theme hiện tại với scene 3D
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    window.House3D.applyTheme(current === 'dark' ? 'night' : 'day');

    // Nghe sự kiện đổi theme
    document.addEventListener('themechange', function (e) {
      var t = (e.detail && e.detail.theme) || 'light';
      if (window.House3D.applyTheme) {
        window.House3D.applyTheme(t === 'dark' ? 'night' : 'day');
      }
    });
  }

  /* ---------------------------------------------------------------
     7. CONSOLE 3D — UI gõ lệnh điều khiển scene
     --------------------------------------------------------------- */
  function initConsole3D() {
    if (!window.Console3D) return;
    try {
      window.Console3D.init();
    } catch (e) {
      console.warn('Console3D init lỗi:', e);
    }
  }

  /* ---------------------------------------------------------------
     8. GLOW THEO CON TRỎ (radial light) trên body
     --------------------------------------------------------------- */
  function initPointerGlowGlobal() {
    if (!hasFinePointer) return;
    var glow = $('#pointer-glow');
    if (!glow) return;
    var x = 0, y = 0, cx = 0, cy = 0, raf = null;

    window.addEventListener('mousemove', function (e) {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    function loop() {
      cx += (x - cx) * 0.12;
      cy += (y - cy) * 0.12;
      glow.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0) translate(-50%,-50%)';
      if (Math.abs(x - cx) > 0.5 || Math.abs(y - cy) > 0.5) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }
  }

  /* ---------------------------------------------------------------
     8. BẢNG CHẨN ĐOÁN (nhấn phím D)
        Giúp xác nhận chính xác nguyên nhân "Chrome PC mất hiệu ứng"
        trên máy thật thay vì đoán: GSAP/ScrollTrigger/Lenis/THREE/WebGL
        đã nạp chưa, reducedMotion, hasFinePointer, maxTouchPoints, FPS.
     --------------------------------------------------------------- */
  function initDiagnostics() {
    var panel = document.createElement('div');
    panel.id = 'diag-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML =
      '<div class="diag-panel__hd">DIAGNOSTICS <button type="button" class="diag-panel__x" aria-label="Đóng">&times;</button></div>' +
      '<div class="diag-panel__body"></div>';
    document.body.appendChild(panel);
    var body = panel.querySelector('.diag-panel__body');

    var fpsSamples = [];
    var last = performance.now();
    (function tick(now) {
      var dt = (now - last) / 1000;
      last = now;
      if (dt > 0) {
        fpsSamples.push(1 / dt);
        if (fpsSamples.length > 60) fpsSamples.shift();
      }
      if (panel.classList.contains('is-open')) render();
      requestAnimationFrame(tick);
    })(performance.now());

    function row(label, value, ok) {
      var cls = ok === undefined ? '' : ok ? 'ok' : 'bad';
      return (
        '<div class="diag-row"><span class="diag-row__k">' + label + '</span>' +
        '<span class="diag-row__v ' + cls + '">' + value + '</span></div>'
      );
    }

    function render() {
      var gsapOk = typeof window.gsap !== 'undefined';
      var stOk = gsapOk && !!window.ScrollTrigger;
      var lenisOk = !!(window.Motion && window.Motion.lenis);
      var threeOk = typeof window.THREE !== 'undefined';
      var houseOk = !!(window.House3D && window.House3D.scene);
      var webgl = false;
      try {
        var c = document.createElement('canvas');
        webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
      } catch (e) {}
      var fps = 0;
      if (fpsSamples.length) {
        var s = 0;
        for (var i = 0; i < fpsSamples.length; i++) s += fpsSamples[i];
        fps = Math.round(s / fpsSamples.length);
      }
      var stCount = 0;
      try {
        if (window.ScrollTrigger && window.ScrollTrigger.getAll) {
          stCount = window.ScrollTrigger.getAll().length;
        }
      } catch (e) {}

      body.innerHTML =
        row('GSAP', gsapOk ? window.gsap.version : 'KHÔNG CÓ', gsapOk) +
        row('ScrollTrigger', stOk ? 'đã nạp' : 'KHÔNG CÓ', stOk) +
        row('Số ScrollTrigger', stCount) +
        row('Lenis smooth-scroll', lenisOk ? 'đang chạy' : 'tắt') +
        row('THREE', threeOk ? window.THREE.REVISION : 'KHÔNG CÓ', threeOk) +
        row('House3D scene', houseOk ? 'đã tạo' : 'chưa', houseOk) +
        row('WebGL', webgl ? 'hỗ trợ' : 'KHÔNG', webgl) +
        row('prefers-reduced-motion', reduce ? 'REDUCE (tắt motion lớn)' : 'no-preference', !reduce) +
        row('hasFinePointer (chuột)', hasFinePointer ? 'CÓ — hiệu ứng chuột BẬT' : 'KHÔNG — tắt hiệu ứng chuột', hasFinePointer) +
        row('hover: hover', window.matchMedia('(hover: hover)').matches ? 'có' : 'không') +
        row('maxTouchPoints', navigator.maxTouchPoints || 0) +
        row('isTouch', isTouch ? 'true' : 'false') +
        row('hardwareConcurrency', navigator.hardwareConcurrency || '?') +
        row('FPS', fps, fps >= 45) +
        row('Viewport', window.innerWidth + ' × ' + window.innerHeight) +
        row('DPR', window.devicePixelRatio || 1);
    }

    function toggle(force) {
      var open = force !== undefined ? force : !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', open);
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) render();
    }

    panel.querySelector('.diag-panel__x').addEventListener('click', function () {
      toggle(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'd' && e.key !== 'D' && e.key !== 'đ' && e.key !== 'Đ') return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();
      toggle();
    });

    window.Diag = { toggle: toggle, render: render };
  }

  /* ---------------------------------------------------------------
     BOOT
     --------------------------------------------------------------- */
  Landing.init = function () {
    initParticles();
    initCounters();
    initAccordion();
    initMarquee();
    initPointerGlow();
    initPointerGlowGlobal();
    initScene();
    initConsole3D();
    initDiagnostics();
  };
})(window, document);
