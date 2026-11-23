# sn-phgt — Happy Birthday Gia Trí | Solo Leveling

Website sinh nhật Solo Leveling (React + Vite + Tailwind), deploy lên GitHub Pages.

**Live:** https://longcaotien.github.io/sn-phgt/

## Nội dung

1. **Boot Sequence** — Hệ thống đánh thức Người Chơi.
2. **Chương I · ARISE** — thiệp chúc mừng sinh nhật, chỉ số Người Chơi, đếm ngược tới 30/11, hiệu ứng ARISE.
3. **Chương II · HỒNG NGỤC** — thử thách 3 tượng thần:
   - Cầu nguyện (giữ `Space` / giữ nút).
   - Không ngẩng đầu khi tượng thần nhìn xuống.
   - Né 12 đợt trừng phạt qua 3 làn với **4 đội hình**: 1 tia · 2 tia sát nhau ·
     **2 tia hai bên** (bỏ trống làn giữa) · **ĐỢT KÉP** (đợt 9-12: né nhịp 1,
     rồi bị đánh đúng làn vừa chạy tới nên phải né tiếp nhịp 2).
4. **BOSS CUỐI · TƯỢNG THẦN MỈM CƯỜI (cấp SSS)** — 3 thanh máu, 3 kỹ năng đặc biệt, 2 lần chuyển pha:
   - `TRỪNG PHẠT · NHÌN THẲNG` → di chuyển sang làn an toàn (`←/→`, `A/D`, chạm làn);
     tia bắn từ **mắt gần làn đó nhất**, mỗi làn một sắc màu riêng.
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

## Hệ thống đọc vị & đội hình đòn đánh

`src/components/chapter2/bossAI.ts` · lớp `PlayerBehaviorTracker`

**Mô hình dự đoán** (kết hợp 4 nguồn):
1. Softmax tuyến tính trên 10 đặc trưng (làn hiện tại, hướng né trước, tần suất làn, chu kỳ đảo làn…),
2. Markov bậc 2 (bigram `làn trước → làn hiện tại → làn kế`),
3. Thiên hướng né theo từng chiêu (`skillDodge`),
4. Gemini API (tuỳ chọn, chạy nền).

**Chọn đội hình** (`pickTargetedLanes`): trước đây chỉ có 3 kiểu cố định
(`[0,1]`, `[1,2]`, `[0,2]` chọn ngẫu nhiên) nên người chơi luôn thấy 2 tia sát
nhau và rất dễ đoán. Nay là **bảng khuôn mẫu có trọng số**:

| Khuôn mẫu | Mở từ | Ghi chú |
| --- | --- | --- |
| `L0/L1/L2` (1 tia) | đợt 1 | |
| `ADJ_L` `[0,1]`, `ADJ_R` `[1,2]` | đợt 3 | 2 tia sát nhau |
| `SPLIT` `[0,2]` | đợt 3 | **2 tia hai bên** — trước đây không bao giờ xuất hiện |
| `DOUBLE` | đợt 9 | đợt kép 2 nhịp, luôn còn đúng 1 làn sống |

Trọng số bị điều chỉnh bởi: khuôn mẫu vừa dùng (giảm 82%), lặp liên tiếp,
khuôn mẫu chưa từng xuất hiện trong trận (×1.35), và **đọc vị** — khuôn mẫu nào
phủ đúng làn AI dự đoán người chơi sẽ chạy tới thì được cộng điểm.

> Quy tắc công bằng: **không bao giờ** đánh cả 3 làn cùng lúc. Mô phỏng 6000 đợt
> cho 0 tình huống bất khả thi; tỉ lệ "2 tia hai bên" ≈ 27% (màn né) / 34% (boss).

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

## Khu vườn sinh nhật — dàn dựng & nhân vật động

`src/components/birthday/` dựng cảnh bằng 5 lớp xếp chồng, tất cả đều chạy bằng `transform`/`opacity`
để GPU lo liệu, không có layout reflow trong lúc animate.

| Lớp | Nội dung | File |
| --- | --- | --- |
| 1 | Nền hoàng hôn parallax (scale 1.03 ↔ 1.065, chu kỳ 28 s) | `BirthdayWorld.tsx` |
| 2 | Tia sáng thần tiên (god rays), sương, chim trời, bướm & ong bay | `NatureCanvas.tsx` (`layer="back"`) |
| 3 | Hai cô hầu gái + bàn thiệp + bàn dao + linh vật | `BirthdayWorld.tsx`, `GardenTables.tsx`, `GardenCreatures.tsx` |
| 4 | Cỏ tiền cảnh, cánh sakura, bokeh | `NatureCanvas.tsx` (`layer="front"`) |
| 5 | Vignette điện ảnh + sương ấm chân cảnh | `.cinema-vignette` trong `index.css` |

### Nhân vật động

- **Hầu gái đọc sách**: thở đa nhịp (5,4 s, 5 keyframe), nghiêng người theo gió, `scaleY` 1 → 1,011,
  lọn tóc mai lay, vệt sáng lật trang, `brightness`/`saturate` nhấp nhẹ, hào quang ấm phía sau.
- **Hầu gái nâng bánh**: nhịp thở 4,6 s; khi cắt bánh xong chuyển sang **pose reo vui** —
  nhún 2 nhịp (`y: 0 → -14 → 0 → -8 → 0`, `rotate` ±1,6°) rồi trở lại nhịp thở.
- **Mèo mun & mèo trắng** (`GardenCreatures.tsx`): thở, vẫy đuôi (radial-gradient đuôi tự vẽ, không tốn ảnh),
  mắt lấp lánh, thỉnh thoảng **ngước nhìn bướm** theo chu kỳ 9–13 s (`catLookUp` state).
- **Bướm, ong, chim sẻ**: bướm bay quỹ đạo 7 điểm trong 17 s; ong vẽ bằng path arc;
  chim sẻ nhảy nhót 9 s. Tất cả đều thuần SVG/hình học, không thêm byte ảnh.

### Guard hiệu năng (giữ nguyên từ vòng tối ưu trước)

`GardenCreatures.tsx` đọc `lowEnd` / `reduceMotionEnabled` từ `utils/perf.ts`:

- `reduceMotionEnabled` → đứng yên hoàn toàn (`calm`), bỏ đom đóm.
- `lowEnd` → mọi chu kỳ nhân 1,35 (animate ít khung hình hơn), đom đóm giảm còn 50 %.
- `NatureCanvas` vẫn dùng `particleScale` cho số hạt và `createFrameLoop` (dừng khi tab ẩn).

### Thêm linh vật mới

Đặt ảnh WebP nền trong suốt vào `src/assets/`, rồi dùng lại `GardenCat` / `GardenButterfly` /
`GardenSparrow` với toạ độ `left`/`bottom` theo phần trăm. Vị trí hiện tại đã né vùng tiêu đề
(`top` 42–52 %) và hai bàn (hai bên mép dưới).
