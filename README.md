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

## Tối ưu hiệu năng vòng 4 — đo FPS thật & chuyển sang CSS

Vòng này xử lý các nguyên nhân lag còn lại sau khi đã tối ưu phần tải trang.
Nguyên tắc: **đo trước, sửa sau**, và ưu tiên để trình duyệt làm thay JS.

### 1. Bộ điều tiết chất lượng thích ứng (`src/utils/perf.ts`)

`lowEnd` chỉ dò phần cứng **một lần** lúc tải (`hardwareConcurrency`,
`deviceMemory`). Nhưng máy có thể yếu vì lý do nó không thấy: GPU tích hợp yếu,
đang chạy tác vụ nặng, màn hình 4K, pin yếu làm CPU hạ xung.

Bộ điều tiết mới đo FPS thật từ chính canvas rồi hạ cấp dần:

| Mức | Kích hoạt | Hiệu ứng |
| --- | --- | --- |
| `2` đầy đủ | mặc định | tất cả |
| `1` vừa (`html.q-lite`) | 3 cửa sổ đo liên tiếp tệ, hoặc TB < 34fps | tắt `backdrop-filter`, bỏ blur lớn, canvas 30fps |
| `0` tối thiểu (`html.q-min`) | TB < 26fps | tắt hết hiệu ứng trang trí, canvas 24fps |

Chính sách chống "hạ oan":
- Đo theo **cửa sổ trượt 3 mẫu** (mỗi mẫu 1,6 s) thay vì một mẫu đơn.
- Chờ **1,8 s** đầu cho trang ổn định rồi mới đo.
- Sau mỗi lần hạ, nghỉ đo **2,5 giây** (mốc thời gian tuyệt đối, không đếm
  frame — đếm frame sẽ sai trên máy yếu).
- **Chỉ hạ, không tự nâng lại** để tránh nhấp nháy lên xuống.

Đã mô phỏng bằng script để kiểm chứng hành vi:

| Tình huống FPS | Kết quả |
| --- | --- |
| 60 / 50 / 45 fps | giữ mức 2, không hạ |
| 38 fps đều | hạ về 1 sau ~7 s |
| giật xen kẽ 22↔58 fps | hạ về 1 sau ~31 s (không hạ oan ngay) |
| tệ hẳn 18 fps | hạ 1 rồi 0, cách nhau ~7 s |

### 2. Chuyển animation trang trí từ framer-motion sang CSS

Đây là thay đổi lớn nhất. framer-motion tính toán và **ghi style cho từng phần
tử trong JS ở mỗi khung hình**. Với cảnh vườn có ~85 phần tử `motion.*` chạy
vòng lặp vô hạn, đó là hàng nghìn thao tác ghi style mỗi giây trên main thread.

Đã chuyển sang CSS `@keyframes` (chạy trên **compositor thread**, 0 JS/frame):

| Phần tử | Trước | Sau |
| --- | --- | --- |
| Mèo (thở, mắt) | 6 `motion` | 0 (CSS `.cat-body`, `.cat-eye`) |
| Bướm (bay, vỗ cánh) | 6 `motion` | 0 (`.bfly-path`, `.bfly-flap`) |
| Chim sẻ | 4 `motion` | 0 (`.sparrow-hop`, `.sparrow-bob`) |
| Đom đóm | 7 `motion` | CSS `.ffly`, tự tắt khi máy yếu |
| Hai bàn (7 hiệu ứng) | 8 `motion` | **0**, file không còn import framer-motion |
| Hầu gái (nhịp thở + tóc) | 3 vòng lặp JS | CSS `.maid-breathe`, `.hair-sway` |
| Ngọn nến (3) | 3 `motion` | CSS `.flame-flick` |
| Thanh sóng nhạc (6) | 6 `motion` | CSS `.eq-bar` |

Kết quả: `GardenTables.tsx` và `GardenCreatures.tsx` **không còn một phần tử
`motion.*` nào**; bundle `BirthdayWorld` giảm 52,50 → 50,45 kB (16,10 → 15,72 kB gz).

### 3. Bỏ animation trên thuộc tính gây rasterize / layout

Ba trường hợp đắt nhất đã được thay bằng lớp overlay chỉ đổi `opacity`:

- **`filter: brightness()` trên ảnh hầu gái 440×728** — mỗi khung hình trình
  duyệt phải rasterize lại toàn bộ ảnh trên CPU. Thay bằng overlay
  `mix-blend-soft-light` đổi opacity.
- **`textShadow` trên tiêu đề gradient** — buộc vẽ lại toàn bộ glyph mỗi khung.
  Thay bằng quầng sáng `blur-2xl` đổi opacity/scale.
- **`height` của thanh sóng nhạc** — gây layout mỗi khung hình.

### 4. Canvas & GPU

- **God rays**: bỏ `createLinearGradient` trong vòng lặp vẽ (cấp phát + rasterize
  mỗi frame) → dùng **sprite dựng sẵn** + `drawImage` xoay nhẹ.
- FPS canvas nền giờ lấy từ `targetFps()` (45 → 30 → 24) thay vì hằng số.
- Mật độ hạt nhân thêm `qualityScale()`.
- `BossVfxCanvas`: cờ `GLOW` (bóng mờ `shadowBlur` — thứ đắt nhất trong canvas
  2D) giờ đọc lại **mỗi frame** theo mức chất lượng, không chốt một lần lúc tải.

### 5. CSS & layout

- `@source` giới hạn phạm vi quét của Tailwind v4 — trước đây nó quét cả `dist/`
  nên CSS phình dần qua mỗi lần build.
- `.contain-paint` cho các quầng sáng blur lớn: cô lập vùng repaint.
- `.will-transform` chỉ đặt cho 2 nhân vật thật sự animate (lạm dụng
  `will-change` sẽ tốn VRAM và phản tác dụng).

## Giọng nói cô hầu gái (tiếng Nhật)

Khi bước vào khu vườn, cô hầu gái chúc mừng sinh nhật bằng tiếng Nhật — giọng
anime nữ, dễ thương (đã tạo sẵn, không gọi API lúc chạy).

| File | Nội dung | Dùng khi |
| --- | --- | --- |
| `src/assets/voice/maid-entry.mp3` | 「ご主人様、お誕生日おめでとうございます！…」 | Vừa bước vào vườn (~0,9 s sau khi cảnh hiện) |
| `src/assets/voice/maid-cake.mp3` | 「わぁ、上手に切れましたね！さすがご主人様です。はい、あーん。」 | Cắt bánh xong |

Tổng dung lượng 204 KB, chỉ tải khi vào khu vườn (chunk `BirthdayWorld`).

### Kiến trúc (`maidVoice.ts`)

- **Preload** cả 2 file để câu đầu tiên phát ngay, không trễ.
- **Ducking**: khi cô ấy nói, nhạc nền tự hạ xuống 15 % rồi trả lại đủ khi nói
  xong. Nhạc nền có một `masterGain` duy nhất nên chỉ cần đổi 1 giá trị thay vì
  sửa từng nốt đang ngân.
- **Autoplay bị chặn** được xử lý như trạng thái bình thường: `needsGesture`
  bật lên và một nút “🔈 Chạm để nghe hầu gái chúc mừng” hiện ra. Trình duyệt chỉ
  cho phát audio sau thao tác của người dùng — không thể lách.
- **Không chồng tiếng**: câu mới tự cắt câu cũ. Có cờ `stoppingOnPurpose` để
  việc chủ động `pause()` không bị hiểu nhầm là “nói xong” (nếu thiếu cờ này,
  âm lượng nhạc sẽ nhấp nháy 0,15 → 1 → 0,15 mỗi lần chuyển câu).
- **Nút bật/tắt** giọng ở header (cạnh nút nhạc), có chấm hồng nhấp nháy khi
  đang nói. Trạng thái tắt tiếng được giữ trong bộ nhớ của phiên.

### Bong bóng phụ đề

Khi cô ấy nói, một bong bóng thoại hiện phía trên nhân vật: câu tiếng Nhật
(phụ đề gốc) + dòng tiếng Việt nhỏ bên dưới, kèm 3 thanh sóng âm nhấp nháy
(CSS `.voice-wave`, tự tắt ở mức `q-min`).

### Đổi giọng / thêm câu thoại

Sinh file mới rồi thêm vào `LINES` trong `maidVoice.ts`:

```ts
import newSrc from "../../assets/voice/maid-new.mp3";
const LINES = { entry: entrySrc, cake: cakeSrc, newLine: newSrc };
```

Sau đó gọi `maidVoice.say("newLine")`. Giữ âm lượng đỉnh khoảng −3 dB và độ dài
dưới 12 giây để không lấn nhạc nền.
