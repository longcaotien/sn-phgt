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

## Hoạt ảnh nói & phản ứng của hai cô hầu gái

### Hoạt ảnh nói: dùng frame ảnh thật (`TalkingMaidSprite.tsx`)

**Bản đầu tiên làm sai:** phủ một elip tối lên vị trí miệng. Nó trông giả và
lệch khớp với nụ cười vẽ sẵn trong tranh (thành ra hai cái miệng). Đã bỏ hoàn toàn.

**Cách đúng:** tạo thêm các frame cùng bố cục, chỉ khác phần miệng, rồi luân phiên.

| Frame | Nội dung | Dung lượng |
| --- | --- | --- |
| `maid-cake.webp` | miệng đóng, mỉm cười (ảnh gốc) | 40 KB |
| `talk/maid-cake-1.webp` | miệng mở nhẹ (âm "a" mềm) | 32 KB |
| `talk/maid-cake-2.webp` | miệng mở rộng (đang nói vui) | 32 KB |

Cả ba đều `440×728` và **khớp pixel tuyệt đối** với ảnh gốc — đã kiểm bằng
`compare -metric RMSE -subimage-search`: vị trí khớp là `@ 80,400` với độ lệch
**0 px** so với vị trí chèn. Nhờ vậy khi đổi frame, trình duyệt chỉ vẽ lại vài
pixel quanh miệng: không lệch hình, không thấy viền, không "nhảy".

Kiểm tra vùng khác biệt cũng xác nhận đúng ý đồ:

| Vùng | RMSE frame 1 | RMSE frame 2 |
| --- | --- | --- |
| **miệng** | **0,0598** | **0,0902** |
| mắt | 0,0476 | 0,0672 |
| bánh kem | 0,0202 | 0,0200 |
| váy / tạp dề | 0,0202 | 0,0201 |
| đỉnh đầu | 0,0230 | 0,0294 |

Vùng miệng là nơi khác biệt **lớn nhất** (~3–4,5 lần các vùng khác) — đúng là
chỉ miệng thay đổi.

> **Lỗi đã gặp và cách phòng:** nền ảnh do AI sinh ra **không phải màu trắng
> đều** (có vignette xám ~197 ở rìa), nên lệnh `floodfill` tách nền dừng lại
> giữa chừng và để lại một tấm nền trắng đục che cả khung cảnh. Cách chắc chắn:
> vì các frame đã khớp pixel tuyệt đối với ảnh gốc, **dùng lại chính alpha mask
> của ảnh gốc**:
>
> ```bash
> convert base.webp -alpha extract mask.png
> convert frame.png -alpha off rgb.png
> convert rgb.png mask.png -alpha off -compose CopyOpacity -composite out.png
> ```
>
> Kiểm tra sau khi tách: tỉ lệ pixel đục của frame phải **bằng đúng** ảnh gốc
> (`convert f.webp -alpha extract -threshold 50% -format "%[fx:mean]" info:`).
> Nếu lệch, nền chưa được tách hết.

**Nhịp đổi frame:** ngẫu nhiên 95–190 ms, và **luôn chọn frame khác frame hiện
tại** để mắt luôn thấy thay đổi. Không dùng nhịp cố định vì sẽ trông như máy.

**Kỹ thuật:** một ảnh gốc giữ chỗ (quyết định kích thước khung, không bao giờ
đổi) + các frame chồng tuyệt đối `inset-0`, chỉ frame đang chọn có `opacity: 1`.
Không dùng `src` hoán đổi vì sẽ gây nháy trắng khi ảnh chưa giải mã xong.

Tôn trọng `prefers-reduced-motion`: giữ frame há miệng nhẹ, không đổi liên tục.

### Cô đọc sách đứng dậy vỗ tay

Khi cô hầu gái nâng bánh **nói**, cô đang ngồi đọc sách sẽ **đứng dậy vỗ tay**;
nói xong thì **ngồi xuống lại**.

- Ảnh tư thế đứng: `src/assets/maid-clap.webp` (560×1425, 77 KB) — cùng thiết kế
  nhân vật, đang đứng vỗ tay, mắt cười.
- Hai ảnh chồng lên nhau trong cùng một khung, crossfade 0,45 s kèm `scale` +
  `y` nhẹ để không bị "nhảy" hình.
- Ảnh đứng neo `bottom-0` và cao hơn (30/52/58 vh so với 21/37/42 vh) để tỉ lệ
  cơ thể đúng khi đứng. Bề rộng hẹp hơn ảnh ngồi ~5 vh nên không tràn lề.
- Đồng bộ qua `voice.speaking`: bật ngay khi bắt đầu nói, tắt **trễ 600 ms**
  để động tác ngồi xuống không bị cụt.
- Hiệu ứng kèm: 3 vòng sóng toả từ bàn tay + chữ 「パチパチ ♪」 bay lên.

### Thêm frame nói cho nhân vật khác

1. Tạo ảnh cùng bố cục, **chỉ đổi miệng** (dùng ảnh gốc làm tham chiếu).
2. Cắt về đúng kích thước ảnh gốc, tách nền trắng → trong suốt.
3. Kiểm tra độ lệch: `compare -metric RMSE -subimage-search <frame> <probe> null:`
   — toạ độ trả về phải trùng vị trí đã cắt `probe`.
4. Thêm vào mảng `FRAMES` trong `TalkingMaidSprite.tsx`.

---

## Đăng nhập &amp; quản trị

Web có 2 trang:

| Trang | Đường dẫn | Dành cho |
| --- | --- | --- |
| Web chính | `index.html` | Khách mời — phải đăng nhập Google |
| Quản trị | `admin.html` | Chỉ email trong `admin_emails()` |

### Vì sao cần backend

Trang đang chạy trên GitHub Pages — **thuần tĩnh, không có server**. Ba yêu cầu
(đăng nhập, chặn người dùng, giấu API key) đều cần một nơi chạy mã phía server.
Dự án dùng **Supabase** (miễn phí, có Google OAuth sẵn).

> Không thể làm những việc này chỉ bằng JavaScript trong trình duyệt: bất cứ gì
> chạy trên máy người dùng đều do người dùng kiểm soát. Một "màn hình khoá" viết
> bằng JS thì mở DevTools là vượt qua được.

### Cài đặt lần đầu (≈10 phút)

**1. Tạo project Supabase** → https://supabase.com/dashboard

**2. Chạy schema** — SQL Editor → dán toàn bộ `supabase/migrations/0001_init.sql` → Run

⚠️ Trước khi chạy, sửa dòng này thành email Google của bạn:

```sql
select string_to_array(lower('thay-email-cua-ban@gmail.com'), ',');
```

**3. Bật Google login** — Authentication → Providers → Google → bật.
Cần Client ID + Secret từ https://console.cloud.google.com/apis/credentials
(loại *OAuth client ID* → *Web application*).

Ở Google Cloud, thêm **Authorized redirect URI**:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

**4. Cho phép web gọi auth** — Authentication → URL Configuration:

- *Site URL*: `https://longcaotien.github.io/sn-phgt/`
- *Redirect URLs*: thêm `https://longcaotien.github.io/sn-phgt/**`
  và `http://localhost:5173/**` (để chạy thử ở máy)

**5. Deploy 2 edge function**

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy gemini --no-verify-jwt
supabase functions deploy gemini-key
```

`gemini` để `--no-verify-jwt` vì khách chưa đăng nhập vẫn phải qua được bước
kiểm tra (function tự kiểm tra quyền bên trong). `gemini-key` thì **bắt buộc**
có JWT vì chỉ admin dùng.

**6. Đưa URL + anon key vào web**

Chạy ở máy: sao chép `.env.example` → `.env` rồi điền.
Trên GitHub: Settings → Secrets and variables → Actions → thêm
`VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.

Hai giá trị này **công khai có chủ ý** — chúng nằm trong bundle và điều đó
không sao, vì RLS mới là thứ quyết định ai đọc được gì.

### Dùng trang quản trị

Mở `https://longcaotien.github.io/sn-phgt/admin.html`.

| Tab | Làm được gì |
| --- | --- |
| **Tổng quan** | Công tắc đóng/mở toàn web, sửa lời nhắn bảo trì |
| **Người dùng** | Xem ai đã đăng nhập, chặn / mở lại từng người |
| **Gemini AI** | Dán hoặc xoá API key, bật/tắt trợ lý AI |

### API key Gemini được giấu thế nào

| Trước | Sau |
| --- | --- |
| Lưu ở `localStorage` → mở DevTools là đọc được | Lưu ở bảng `app_secrets` với **RLS bật nhưng 0 policy** |
| Trình duyệt gọi thẳng Google, key nằm trong URL | Trình duyệt gọi edge function, key do server gắn vào |

Kiểm chứng: trong bundle gửi cho người dùng **không còn** chuỗi
`sl_gemini_api_key` hay `generativelanguage.googleapis.com`.

```
$ grep -rl "generativelanguage" dist/assets/
(không có kết quả)
```

### Ba lớp bảo vệ

1. **RLS ở database** — người dùng thường không `select` được `profiles` của
   người khác, không `update` được `site_config`, không đọc được `app_secrets`.

> Vì sao không dùng schema riêng tên `private`: PostgREST không cho client chọn
> schema khi chưa khai báo trong *Exposed schemas*, nên edge function sẽ lỗi
> 406. Để bảng trong `public` nhưng **bật RLS + không tạo policy nào** là cách
> chắc chắn hơn: RLS bật mà 0 policy thì chặn tuyệt đối với `anon` và
> `authenticated`, còn `service_role` vẫn dùng được.
   Đây là lớp thật; các lớp dưới chỉ là trải nghiệm.
2. **Cổng ở giao diện** — hiện màn hình đăng nhập / bị chặn / bảo trì.
3. **Edge function** — từ chối phục vụ AI nếu site đang đóng, người dùng bị
   chặn, hoặc AI đang tắt. Có giới hạn 40 lượt / phút mỗi người.

### Fail-open có chủ ý

Nếu Supabase không gọi được (mất mạng, project bị tạm dừng), web **vẫn mở**
thay vì khoá tất cả khách mời. Dữ liệu thật vẫn an toàn vì RLS nằm ở server.
Đánh đổi này có chủ ý: trong ngày sinh nhật, thà web mở còn hơn chặn oan.

### Chỉ admin thấy chức năng dev

Bảng `DEV · NHẢY MÀN` và `GEMINI KEY` chỉ được tải khi `access_state()` trả về
`is_admin = true`. Người dùng thường **không tải chunk** `DevJump-*.js` (8,3 kB).

> Lưu ý trung thực: đây là **ẩn khỏi giao diện**, không phải mã hoá. Người rành
> kỹ thuật gọi thẳng API vẫn nhận được dữ liệu mà RLS cho phép. Không có gì
> chạy trên máy người dùng là bí mật thật sự.

### Kiểm chứng sau khi cài

| Kiểm tra | Cách làm | Kết quả mong đợi |
| --- | --- | --- |
| Chưa đăng nhập bị chặn | Mở trang ở cửa sổ ẩn danh | Hiện "CỔNG VÀO KHU VƯỜN" |
| Đăng nhập được | Bấm nút Google | Vào được web |
| Chặn có hiệu lực | Admin chặn 1 email → người đó tải lại | Hiện "TÀI KHOẢN ĐÃ BỊ TẠM KHOÁ" |
| Đóng web có hiệu lực | Tắt công tắc → mở tab khác | Hiện "KHU VƯỜN ĐANG ĐÓNG" |
| Key không lộ | DevTools → Network → gọi AI | Không thấy key trong URL/body |
| Dev ẩn với người thường | Đăng nhập email không phải admin | Không có nút DEV ở góc trái |
