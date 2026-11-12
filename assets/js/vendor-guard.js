/* =============================================================
   vendor-guard.js — Nạp thư viện CDN + phát hiện lỗi, bật fallback
   Bảo đảm website vẫn chạy đẹp khi offline / CDN chết.
   ============================================================= */
(function (window) {
  'use strict';

  var V = (window.Vendor = window.Vendor || {});

  V.flags = {
    gsap: false,
    scrollTrigger: false,
    splitText: false,
    lenis: false,
  };

  V.cdn = {
    gsap: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js',
    scrollTrigger:
      'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js',
    splitText:
      'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/SplitText.min.js',
    lenis: 'https://unpkg.com/lenis@1.1.18/dist/lenis.min.js',
  };

  V.reducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Ghi đè chế độ chuyển động đã được đặt sẵn bởi inline script trong
     <head> (xem index.html / presentation.html) — chỉ ghi nhận ở đây. */
  V.motionOverride = window.__motionOverride || null;

  V.isTouch =
    'ontouchstart' in window ||
    (window.navigator && window.navigator.maxTouchPoints > 0);

  /* ---------------------------------------------------------------
     hasFinePointer: user đang dùng CHUỘT hay chỉ màn hình cảm ứng?

     V.isTouch = true trên laptop Windows có màn hình cảm ứng, dù
     đang cầm chuột. Gate hiệu ứng hover/chuột theo isTouch sẽ
     giết sạch hiệu ứng trên Chrome PC. Media query pointer mới là
     tiêu chí đúng cho hiệu ứng chuột.
     --------------------------------------------------------------- */
  var finePointerQuery =
    window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)');
  V.hasFinePointer = finePointerQuery ? finePointerQuery.matches : !V.isTouch;
  if (finePointerQuery && finePointerQuery.addEventListener) {
    finePointerQuery.addEventListener('change', function (e) {
      V.hasFinePointer = e.matches;
    });
  }

  V.lowPower = (function () {
    try {
      var hc = navigator.hardwareConcurrency || 8;
      var dm = navigator.deviceMemory || 8;
      var sd = (navigator.connection && navigator.connection.saveData) === true;
      return V.isTouch || hc <= 4 || dm <= 4 || sd;
    } catch (e) { return V.isTouch; }
  })();
  try {
    if (V.lowPower) document.documentElement.classList.add('low-power');
  } catch (e) {}

  /**
   * Nạp một script bất đồng bộ. Luôn resolve (không reject) để không chặn
   * luồng khởi động của trang.
   * @param {string} url
   * @param {number} timeout ms
   * @returns {Promise<boolean>} true nếu nạp thành công
   */
  V.loadScript = function (url, timeout) {
    return new Promise(function (resolve) {
      if (!url) return resolve(false);
      var done = false;
      var settle = function (ok) {
        if (done) return;
        done = true;
        resolve(ok);
      };
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.crossOrigin = 'anonymous';
      var timer = setTimeout(function () {
        settle(false);
      }, timeout || 9000);
      s.onload = function () {
        clearTimeout(timer);
        settle(true);
      };
      s.onerror = function () {
        clearTimeout(timer);
        settle(false);
      };
      document.head.appendChild(s);
    });
  };

  /**
   * Nạp riêng GSAP (+ ScrollTrigger) cho trang thuyết trình.
   * Không kéo theo Three/Lenis/SplitText để trang slide khởi động nhanh.
   * Luôn gọi done(details) — kể cả khi CDN chết, để fallback CSS chạy.
   * @param {function} done cb(details)
   */
  V.loadMotion = function (done) {
    var g = V.loadScript(V.cdn.gsap).then(function (ok) {
      V.flags.gsap = !!(ok && window.gsap);
      return V.flags.gsap;
    });

    var s = V.loadScript(V.cdn.scrollTrigger).then(function (ok) {
      V.flags.scrollTrigger = !!(ok && window.ScrollTrigger);
      return V.flags.scrollTrigger;
    });

    return Promise.all([g, s]).then(function () {
      if (V.flags.gsap && V.flags.scrollTrigger && window.gsap) {
        try {
          window.gsap.registerPlugin(window.ScrollTrigger);
        } catch (e) {
          /* ignore */
        }
      }
      V.flags.motion = V.flags.gsap && V.flags.scrollTrigger;
      V.flags.enhanced = V.flags.motion && !V.reducedMotion;
      document.documentElement.classList.add(
        V.flags.enhanced ? 'has-motion' : 'no-motion'
      );
      if (typeof done === 'function') done(V.flags);
      return V.flags;
    });
  };

  /**
   * Nạp song song mọi thư viện, đặt cờ trạng thái và báo lại qua callback.
   * @param {function} done cb(details)
   */
  V.loadAll = function (done) {
    var jobs = [];

    jobs.push(
      V.loadScript(V.cdn.gsap).then(function (ok) {
        V.flags.gsap = !!(ok && window.gsap);
      })
    );

    jobs.push(
      V.loadScript(V.cdn.scrollTrigger).then(function (ok) {
        V.flags.scrollTrigger = !!(ok && window.ScrollTrigger);
      })
    );

    jobs.push(
      V.loadScript(V.cdn.splitText).then(function (ok) {
        V.flags.splitText = !!(ok && window.SplitText);
      })
    );

    jobs.push(
      V.loadScript(V.cdn.lenis).then(function (ok) {
        V.flags.lenis = !!(ok && window.Lenis);
      })
    );

    return Promise.all(jobs).then(function () {
      // Đăng ký plugin GSAP nếu có
      if (V.flags.gsap && V.flags.scrollTrigger && window.gsap) {
        try {
          window.gsap.registerPlugin(window.ScrollTrigger);
        } catch (e) {
          /* ignore */
        }
      }
      if (V.flags.gsap && V.flags.splitText && window.gsap) {
        try {
          window.gsap.registerPlugin(window.SplitText);
        } catch (e) {
          /* ignore */
        }
      }
      V.flags.motion = V.flags.gsap && V.flags.scrollTrigger;
      V.flags.enhanced = V.flags.motion && !V.reducedMotion;
      document.documentElement.classList.add(
        V.flags.enhanced ? 'has-motion' : 'no-motion'
      );
      if (typeof done === 'function') done(V.flags);
    });
  };
})(window);
