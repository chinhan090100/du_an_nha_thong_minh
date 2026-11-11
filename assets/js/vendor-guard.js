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
    three: false,
  };

  V.cdn = {
    gsap: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js',
    scrollTrigger:
      'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js',
    splitText:
      'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/SplitText.min.js',
    lenis: 'https://unpkg.com/lenis@1.1.18/dist/lenis.min.js',
    // Three r128 là bản UMD — các addon postprocessing cùng phiên bản cần
    // global THREE nên phải nạp theo thứ tự.
    three: 'https://unpkg.com/three@0.128.0/build/three.min.js',
    threeAddons: [
      'https://unpkg.com/three@0.128.0/examples/js/postprocessing/EffectComposer.js',
      'https://unpkg.com/three@0.128.0/examples/js/postprocessing/RenderPass.js',
      'https://unpkg.com/three@0.128.0/examples/js/postprocessing/ShaderPass.js',
      'https://unpkg.com/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js',
      'https://unpkg.com/three@0.128.0/examples/js/shaders/CopyShader.js',
      'https://unpkg.com/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js',
    ],
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

  V.lowPower = V.isTouch || (navigator.hardwareConcurrency || 8) <= 2;

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

    // Nạp Three trước, sau đó addon postprocessing (phụ thuộc global THREE).
    jobs.push(
      V.loadScript(V.cdn.three).then(function (ok) {
        V.flags.three = !!(ok && window.THREE);
        if (!V.flags.three) return false;
        /* PHẢI nạp addon theo THỨ TỰ: RenderPass/UnrealBloomPass kế thừa
           THREE.Pass (định nghĩa trong EffectComposer.js) và dùng
           CopyShader / LuminosityHighPassShader ở thân class.
           Nạp song song sẽ gây lỗi "THREE is not defined / extends undefined"
           → mất RenderPass → composer không khởi tạo được. */
        var chain = Promise.resolve();
        V.cdn.threeAddons.forEach(function (u) {
          chain = chain.then(function () {
            return V.loadScript(u);
          });
        });
        return chain.then(function () {
          // Addon r128 đính vào namespace THREE (không phải window global)
          V.flags.threeAddons = !!(
            window.THREE &&
            window.THREE.EffectComposer &&
            window.THREE.RenderPass &&
            window.THREE.UnrealBloomPass &&
            window.THREE.ShaderPass &&
            window.THREE.CopyShader &&
            window.THREE.LuminosityHighPassShader
          );
          return V.flags.threeAddons;
        });
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
      document.documentElement.classList.toggle('has-webgl', !!V.flags.three);
      if (typeof done === 'function') done(V.flags);
    });
  };
})(window);
