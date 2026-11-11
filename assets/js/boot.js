/* =============================================================
   boot.js — Điểm khởi động chung cho landing
   Nạp thư viện CDN → chạy preloader → khởi động motion + landing
   ============================================================= */
(function (window, document) {
  'use strict';

  var started = false;

  function start() {
    if (started) return;
    started = true;
    document.body.classList.remove('no-scroll');
    try { window.Motion.init(); } catch (e) { console.warn('Motion init lỗi:', e); }
    try { window.Landing.init(); } catch (e) { console.warn('Landing init lỗi:', e); }
  }

  /* Gỡ preloader an toàn: không phụ thuộc timeline GSAP (nếu timeline bị lag
     hoặc onComplete không chạy, trang kẹt ở body.no-scroll → "đứng yên"). */
  function rescue() {
    document.body.classList.remove('no-scroll');
    var p = document.querySelector('.preloader');
    if (p && p.parentNode) p.parentNode.removeChild(p);
    start();
  }

  function boot() {
    // Preloader + motion/landing
    try {
      window.Motion.preloader(start);
    } catch (e) {
      console.warn('Preloader lỗi:', e);
      start();
    }

    // Cứu hộ sau 2.2s — gỡ no-scroll + xoá preloader dù timeline có chạy hay không
    setTimeout(rescue, 2200);

    // Dự phòng: preloader kẹt → vẫn khởi động
    setTimeout(rescue, 4000);
  }

  if (window.Vendor && window.Vendor.loadAll) {
    window.Vendor.loadAll(function () {
      boot();
    });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
