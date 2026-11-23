# sn-phgt — Happy Birthday Gia Trí | Solo Leveling

Website sinh nhật Solo Leveling (React + Vite + Tailwind), deploy lên GitHub Pages.

**Live:** https://longcaotien.github.io/sn-phgt/

## Nội dung

1. **Boot Sequence** — Hệ thống đánh thức Người Chơi.
2. **Chương I · ARISE** — thiệp chúc mừng sinh nhật, chỉ số Người Chơi, đếm ngược tới 30/11, hiệu ứng ARISE.
3. **Chương II · HỒNG NGỤC** — thử thách 3 tượng thần:
   - Cầu nguyện (giữ `Space` / giữ nút).
   - Không ngẩng đầu khi tượng thần nhìn xuống.
   - Né 12 đợt trừng phạt qua 3 làn.
4. **BOSS CUỐI · TƯỢNG THẦN MỈM CƯỜI (cấp SSS)** — 3 thanh máu, 3 kỹ năng đặc biệt, 2 lần chuyển pha:
   - `TRỪNG PHẠT · NHÌN THẲNG` → di chuyển sang làn an toàn (`←/→`, `A/D`, chạm làn).
   - `CUỒNG TIẾNG CƯỜI` → **giữ** để chịu đòn và nạp nội lực (`Space` / giữ nút).
   - `NẮM ĐẤM THẦN` → **nhấn đúng nhịp** phản công (`Space` / chạm).
   - Pha 2 (còn 2 thanh máu): boss cuồng nộ, đổi hình, tăng tốc.
   - Pha 3 (thanh máu cuối): chiêu tối thượng **ĐIỆU CƯỜI TỬ THẦN**.
5. **Phần thưởng** — xếp hạng S+/S/A/B, thống kê trận đấu và lời chúc sinh nhật.

Khi gục ngã có thể **HỒI SINH** và tiếp tục đúng tiến độ thanh máu của boss.

## Chạy local

```bash
npm ci
npm run dev      # dev server
npm run build    # build production vào thư mục dist/
npm run preview  # xem bản build
```

## Deploy lên GitHub Pages

Workflow `.github/workflows/deploy.yml` tự động build + deploy mỗi khi push lên `main`
(có thể chạy tay qua tab **Actions → Deploy to GitHub Pages → Run workflow**).

> ⚠️ **Bắt buộc làm 1 lần trước lần deploy đầu tiên** (nếu không job `deploy` sẽ lỗi 404
> `Failed to create deployment ... Ensure GitHub Pages has been enabled`):
>
> 1. Vào [Settings → Pages](https://github.com/longcaotien/sn-phgt/settings/pages)
> 2. Mục **Build and deployment → Source**, chọn **GitHub Actions** → **Save**
> 3. Vào tab **Actions**, chạy lại workflow (hoặc push 1 commit lên `main`)
>
> Sau đó site sẽ live tại https://longcaotien.github.io/sn-phgt/ trong ~1 phút.

## Ghi chú cấu hình

- `vite.config.ts` dùng `base: "./"` (đường dẫn tương đối) nên chạy đúng trên
  project page `/sn-phgt/` mà không cần đổi cấu hình.
- Build xuất ra `dist/index.html` + `dist/assets/*` (JS/CSS/ảnh tách riêng, có hash).
- `public/.nojekyll` đảm bảo GitHub Pages không xử lý file bằng Jekyll.
- `server.allowedHosts = true` chỉ phục vụ môi trường preview của sandbox (dev), không ảnh hưởng bản build.

## Tối ưu hiệu năng (kiến trúc)

Site được tối ưu để mượt trên cả máy yếu. Các điểm chính:

| Khu vực | Trước | Sau |
| --- | --- | --- |
| Kích thước tải lần đầu | 1 file `index.html` 3.2 MB (mọi ảnh base64 + toàn bộ code) | ~30 KB HTML + ~112 KB JS gzip (React + framer-motion + Hero) |
| Chương II / Sinh nhật | nằm trong bundle chính | tách chunk, chỉ tải khi bước vào (+ preload khi rảnh) |
| Cache | mọi lần mở tải lại 3.2 MB | file có hash nội dung → cache vĩnh viễn, mở lại gần như tức thì |
| Ảnh | 2.1 MB (jpg + webp 328 KB) | ~1.1 MB webp đã nén lại, tách file (không base64) |
| Animation JS | mỗi canvas một `requestAnimationFrame` riêng | **một** vòng lặp dùng chung (`src/utils/perf.ts`), tự dừng khi tab ẩn |
| Canvas | DPR tới 2, mỗi hạt tạo `RadialGradient` | giới hạn DPR (1–1.75), sprite nướng sẵn, ít `shadowBlur` trên máy yếu |
| Re-render | `setGauge`/`setDodgePred` mỗi frame → re-render cả cây | ~15 lần/giây + state AI tách ra external store (chỉ badge re-render) |
| Boot sequence | ~9 giây mới vào được Hero | ~4 giây |
| Blur trang trí | `backdrop-filter` + `blur-3xl` chồng trên canvas | tự tắt trên máy yếu (`class="perf-lite"` trên `<html>`) |

### Cách hoạt động

- `src/utils/perf.ts` phát hiện máy yếu (`navigator.hardwareConcurrency`, `deviceMemory`,
  `prefers-reduced-motion`) và xuất: `lowEnd`, `particleScale`, `getMaxDpr()`,
  `createFrameLoop()` (một RAF loop dùng chung, tự pause khi tab ẩn).
- `main.tsx` gắn class `perf-lite` lên `<html>` để CSS tắt `backdrop-filter`/
  `blur` lớn — giữ nguyên giao diện nhưng nhẹ hơn nhiều trên GPU tích hợp.
- `vite.config.ts` tách chunk: `vendor-react`, `vendor-motion`, `Chapter2`,
  `BirthdayWorld`, `DevJump`. **Không dùng** `vite-plugin-singlefile` nữa vì plugin
  đó ép `inlineDynamicImports` và ẩn toàn bộ ảnh vào HTML.

### Thêm ảnh mới

Đặt ảnh vào `src/assets/` dạng `.webp` (chất lượng 70–75, chiều rộng ≤ 1400 px):

```bash
convert anh.jpg -resize 1400x -strip -quality 72 anh.webp
```

## Tài nguyên hình ảnh

- `src/assets/c2/boss1.webp` — Tượng Thần Mỉm Cười (dạng thường).
- `src/assets/c2/boss2.webp` — Tượng Thần Mỉm Cười (dạng cuồng nộ, 4 tay).
- `src/assets/c2/bossArena.webp` — đấu trường tầng sâu nhất.

Ảnh được tối ưu WebP và dùng `mix-blend-mode: screen` + mask để hoà vào nền tối.
