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
- `vite-plugin-singlefile` gộp toàn bộ JS/CSS/ảnh thành 1 file `dist/index.html`,
  không phụ thuộc file phụ.
- `public/.nojekyll` đảm bảo GitHub Pages không xử lý file bằng Jekyll.
- `server.allowedHosts = true` chỉ phục vụ môi trường preview của sandbox (dev), không ảnh hưởng bản build.

## Tài nguyên hình ảnh

- `src/assets/c2/boss1.webp` — Tượng Thần Mỉm Cười (dạng thường).
- `src/assets/c2/boss2.webp` — Tượng Thần Mỉm Cười (dạng cuồng nộ, 4 tay).
- `src/assets/c2/bossArena.jpg` — đấu trường tầng sâu nhất.

Ảnh được tối ưu WebP và dùng `mix-blend-mode: screen` + mask để hoà vào nền tối.
