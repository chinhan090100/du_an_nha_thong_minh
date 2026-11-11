#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Thay cac khoi anh minh hoat trong index.html bang anh that cua mo hinh (match bang regex)."""
import io
import re
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

PATH = r'C:\Users\MY_PC\Desktop\du_an_nha_thong_minh\index.html'

with io.open(PATH, encoding='utf-8') as f:
    html = f.read()

HOUSE_SVG = '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>'
SIDE_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="9"/></svg>'
SOLAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2v6M12 22v-4M4.9 4.9l4.2 4.2M19.1 19.1l-4.2-4.2M2 12h6M22 12h-4"/><circle cx="12" cy="12" r="3.4"/></svg>'
ESP_SVG = '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M10 2v4M14 2v4M10 18v4M14 18v4M2 10h4M2 14h4M18 10h4M18 14h4"/></svg>'
SENSOR_SVG = '<svg viewBox="0 0 24 24"><path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/></svg>'
BOARD_SVG = '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="12" rx="2.5"/><path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 15h10"/></svg>'
LCD_SVG = '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h5"/></svg>'

SHOT = '''        <figure class="illus-shot{cls}">
          <span class="illus" data-tilt="5">
            <img
              class="illus__img"
              src="assets/img/{src}"
              alt="{alt}"
              loading="lazy"
              decoding="async"
              width="{w}"
              height="{h}"
              onerror="this.closest('.illus').classList.add('is-fallback')"
            />
            <span class="illus__fallback" aria-hidden="true">
              {svg}
              {txt}
            </span>
            <span class="illus__caption">{cap}</span>
          </span>
        </figure>
'''


def shot(cls, src, alt, cap, w=1024, h=768, svg=HOUSE_SVG, txt='Mô hình nhà'):
    return SHOT.format(cls=cls, src=src, alt=alt, cap=cap, w=w, h=h, svg=svg, txt=txt)


def gallery(shots):
    return '      <div class="illus-gallery" data-stagger>\n' + ''.join(shots) + '      </div>\n'


gallery_goals = gallery([
    shot(' illus-shot--wide', 'model-09.jpg',
         'Mô hình nhà thông minh hoàn chỉnh — ảnh chụp thực tế sản phẩm của nhóm',
         'Mô hình nhà thông minh — sản phẩm hoàn chỉnh', 1024, 935),
    shot('', 'model-01.jpg',
         'Toàn cảnh mô hình nhà thông minh do nhóm tự lắp ráp',
         'Toàn cảnh mô hình'),
    shot('', 'model-02.jpg',
         'Mặt trước mô hình nhà với cửa sổ, cửa chính và thiết bị cảm biến',
         'Mặt trước — cửa chính &amp; cảm biến'),
    shot('', 'model-03.jpg',
         'Góc bên của mô hình nhà thông minh thể hiện bố trí không gian',
         'Góc bên — bố trí không gian', svg=SIDE_SVG, txt='Góc bên'),
    shot('', 'model-04.jpg',
         'Phần mái nhà và tấm pin năng lượng mặt trời của mô hình',
         'Mái nhà &amp; tấm solar', svg=SOLAR_SVG, txt='Mái &amp; solar'),
    shot('', 'model-05.jpg',
         'Bên trong mô hình: bo mạch ESP32, cảm biến và dây đấu nối',
         'Bên trong — mạch ESP32 &amp; dây đấu', svg=ESP_SVG, txt='Mạch điện'),
    shot('', 'model-06.jpg',
         'Module cảm biến và linh kiện điện tử được lắp trong mô hình',
         'Module cảm biến &amp; linh kiện', svg=BOARD_SVG, txt='Linh kiện'),
    shot('', 'model-07.jpg',
         'Mạch thử với linh kiện điện tử trong quá trình lắp ráp mô hình',
         'Mạch thử trong quá trình lắp ráp', svg=BOARD_SVG, txt='Mạch thử'),
    shot('', 'model-08.jpg',
         'Thiết bị đầu cuối: màn hình hiển thị trạng thái cảm biến của hệ thống',
         'Màn hình hiển thị trạng thái', svg=LCD_SVG, txt='Hiển thị'),
])

gallery_mat = gallery([
    shot('', 'model-05.jpg',
         'Bo mạch ESP32 và cảm biến đã lắp trong mô hình nhà thông minh',
         'Vi xử lý ESP32 — trung tâm điều khiển', svg=ESP_SVG, txt='ESP32'),
    shot('', 'model-07.jpg',
         'Mạch thử với các module cảm biến dùng để lắp ráp mô hình',
         'Cảm biến &amp; mạch thử', svg=SENSOR_SVG, txt='Cảm biến'),
])

gallery_arch = gallery([
    shot('', 'model-06.jpg',
         'Linh kiện điện tử và module relay được lắp đặt trong mô hình',
         'Mạch đấu nối &amp; module relay', svg=BOARD_SVG, txt='Mạch đấu nối'),
    shot('', 'model-08.jpg',
         'Màn hình LCD hiển thị trạng thái cảm biến từ xa qua MQTT',
         'Giao diện theo dõi trạng thái', svg=LCD_SVG, txt='Giao diện'),
])

# Thay theo thu tu cac marker "ANH MINH HOAT" xuat hien trong file
END = '      </div>\n    </div>\n  </section>'

MARKER_RE = re.compile(r'<!-- ===== [^>]*MINH HO[^>]*-->')
matches = list(MARKER_RE.finditer(html))
replacements = [gallery_goals, gallery_mat, gallery_arch]

if len(matches) != len(replacements):
    print('SO MARKER KHONG KHOANG:', len(matches), 'vs', len(replacements))
    sys.exit(1)

out = []
cursor = 0
for m, replacement in zip(matches, replacements):
    end = html.find(END, m.start())
    if end < 0:
        print('KHONG TIM THAY END cho', m.group(0))
        sys.exit(1)
    end += len('      </div>\n')
    out.append(html[cursor:m.start()])
    out.append(replacement)
    cursor = end
    print('DA THAY:', m.group(0))

out.append(html[cursor:])
html = ''.join(out)

with io.open(PATH, 'w', encoding='utf-8', newline='') as f:
    f.write(html)

print('OK')
