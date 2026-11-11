/* =============================================================
   console3d.js — Console gõ lệnh điều khiển scene 3D
   UI terminal overlay + lịch sử lệnh + parser gọi House3D.exec()
   ============================================================= */
(function (window, document) {
  'use strict';

  var Console3D = (window.Console3D = window.Console3D || {});
  var Core = window.Core || {};
  var $ = Core.$ || function (s, c) { return (c || document).querySelector(s); };
  var $$ = Core.$$ || function (s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  };
  var reduce = !!(window.Vendor && window.Vendor.reducedMotion);

  var root = null;
  var panel = null;
  var out = null;
  var input = null;
  var badge = null;
  var form = null;

  var history = [];
  var histIndex = -1;
  var open = false;
  var booted = false;

  var HELP = [
    'CÁC LỆNH SẴN CÓ:',
    '  help              — xem danh sách lệnh',
    '  nha | house       — đưa nhà về góc chuẩn, reset camera',
    '  lights on | off   — bật / tắt đèn nhà',
    '  rain on | off     — bật / tắt mưa + vòng nước bắn',
    '  night | day       — đổi preset ánh sáng (đồng bộ giao diện)',
    '  spin on | off     — bật / tắt xoay tự động',
    '  zoom in | out | reset — phóng / thu camera',
    '  sensors on | off  — hiện / ẩn điểm cảm biến trong scene',
    '  status            — xem trạng thái hiện tại',
    '  clear             — xoá màn hình console',
    '  close             — đóng console',
  ];

  /* ---------------------------------------------------------------
     HIỂN THỊ
     --------------------------------------------------------------- */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function print(text, cls) {
    if (!out) return;
    var line = document.createElement('div');
    line.className = 'console3d__row' + (cls ? ' console3d__row--' + cls : '');
    line.textContent = text;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
  }

  function printLines(lines, cls) {
    if (!lines || !lines.length) return;
    for (var i = 0; i < lines.length; i++) print(lines[i], cls);
  }

  function clearOut() {
    if (out) out.innerHTML = '';
  }

  /* ---------------------------------------------------------------
     MỞ / ĐÓNG
     --------------------------------------------------------------- */
  function setOpen(next) {
    if (!root) return;
    open = !!next;
    root.classList.toggle('is-open', open);
    if (badge) badge.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      if (input) {
        try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
      }
    } else if (document.activeElement === input) {
      input.blur();
    }
  }

  function toggle() {
    setOpen(!open);
  }

  /* ---------------------------------------------------------------
     XỬ LÝ LỆNH
     --------------------------------------------------------------- */
  function run(cmd) {
    var raw = String(cmd || '');
    if (!raw.trim()) return;

    print('> ' + raw, 'cmd');

    if (history[history.length - 1] !== raw) history.push(raw);
    histIndex = history.length;

    var low = raw.trim().toLowerCase();

    /* Lệnh nội bộ của console */
    if (low === 'clear' || low === 'cls') {
      clearOut();
      return;
    }
    if (low === 'close' || low === 'exit' || low === 'quit') {
      print('✔ Đã đóng console.', 'ok');
      setOpen(false);
      return;
    }
    if (low === 'help' || low === '?') {
      printLines(HELP, 'info');
      return;
    }

    /* Lệnh điều khiển scene */
    if (window.House3D && typeof window.House3D.exec === 'function') {
      var res = window.House3D.exec(raw);
      if (res && res.lines && res.lines.length) {
        printLines(res.lines, res.ok ? 'ok' : 'err');
      } else if (res && !res.ok) {
        print('✖ Lệnh không hợp lệ. Gõ "help".', 'err');
      }
      return;
    }

    print('✖ Scene 3D chưa sẵn sàng (thiếu Three.js). Gõ "help" để xem lệnh.', 'err');
  }

  /* ---------------------------------------------------------------
     KHỞI TẠO
     --------------------------------------------------------------- */
  function bind() {
    if (badge) {
      badge.addEventListener('click', function (e) {
        e.stopPropagation();
        toggle();
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var val = input ? input.value : '';
        if (input) input.value = '';
        run(val);
      });
    }

    $$('[data-console-act]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var act = btn.getAttribute('data-console-act');
        if (act === 'clear') clearOut();
        else if (act === 'close') setOpen(false);
      });
    });

    /* Phím tắt: ` hoặc Ctrl+K để mở/đóng */
    document.addEventListener('keydown', function (e) {
      var typing =
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA');

      if ((e.key === '`' || e.key === '~') && !typing) {
        e.preventDefault();
        toggle();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      /* Escape đóng console */
      if (e.key === 'Escape' && open && !typing) {
        setOpen(false);
      }
    });

    /* Lịch sử lệnh: mũi tên lên/xuống */
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (!history.length) return;
          histIndex = Math.max(0, histIndex - 1);
          input.value = history[histIndex] || '';
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!history.length) return;
          histIndex = Math.min(history.length, histIndex + 1);
          input.value = histIndex >= history.length ? '' : history[histIndex];
        }
      });
    }

    /* Click ra ngoài → thu gọn (trừ khi đang gõ) */
    document.addEventListener('click', function (e) {
      if (!open) return;
      if (root && root.contains(e.target)) return;
      setOpen(false);
    });
  }

  Console3D.init = function () {
    if (booted) return;
    root = $('#console3d');
    if (!root) return;
    booted = true;

    panel = $('#console3d-panel');
    out = $('#console3d-out');
    input = $('#console3d-input');
    badge = $('#console3d-badge');
    form = $('#console3d-form');

    bind();

    /* Chào + gợi ý */
    print('ESP32-CONSOLE v1.0 — kết nối thành công.', 'ok');
    print('Gõ "help" để xem danh sách lệnh.', 'info');

    /* Mở sẵn console trên desktop, gọn trên mobile */
    if (window.innerWidth >= 900) setOpen(true);

    /* Dòng mở đầu gợi ý — mô phỏng người dùng gõ */
    if (!reduce) {
      window.setTimeout(function () {
        if (!open) return;
        print('> nha --status', 'cmd');
        printLines(
          [
            'Trạng thái hệ thống:',
            '  Đèn: BẬT',
            '  Mưa: BẬT',
            '  Cảm biến: ẨN',
            '  Ánh sáng: DAY',
            '  Xoay tự động: BẬT',
          ],
          'ok'
        );        print('→ Thử gõ: lights off, rain on, night, sensors on', 'info');
      }, 3200);
    }
  };

  /* Console có thể mở lại từ code khác */
  Console3D.open = function () { setOpen(true); };
  Console3D.close = function () { setOpen(false); };
  Console3D.toggle = toggle;
  Console3D.print = print;
})(window, document);
