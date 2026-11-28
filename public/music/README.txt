THƯ MỤC NHẠC NỀN (BẠN TỰ THÊM FILE VÀO ĐÂY)
================================================

Không cần sửa code. Chỉ cần copy file nhạc vào thư mục này,
đặt đúng tên, rồi push lên GitHub là web tự phát.

┌─────────────────────────────────────────────────────────────┐
│  TÊN FILE               DÙNG CHO CHỖ NÀO                    │
├─────────────────────────────────────────────────────────────┤
│  sanctuary.mp3          SẢNH CHÍNH (màn hình mở đầu)        │
│  birthday.mp3           THẾ GIỚI SINH NHẬT (khu vườn 30/11) │
└─────────────────────────────────────────────────────────────┘

File nào không có thì chỗ đó tự phát nhạc tổng hợp từ Web Audio
(không lỗi, chỉ là giai điệu đơn giản hơn).


ĐỊNH DẠNG
---------
- mp3  → tốt nhất, ai cũng nghe được.  ← KHUYÊN DÙNG
- m4a / aac / ogg → cũng được nhưng ít phổ biến hơn

Đuôi file phải khớp đúng chữ thường: sanctuary.mp3 (không phải .MP3)


DUNG LƯỢNG
----------
Nhạc nền nên nén ở 128 kbps, stereo hoặc mono.
Một bài 3 phút ≈ 2,8 MB. Dưới 5 MB là ổn.

Nén bằng ffmpeg nếu có:
   ffmpeg -i bai-hat-goc.wav -b:a 128k -ac 2 sanctuary.mp3


BẢN QUYỀN — QUAN TRỌNG
-----------------------
Repository này là CÔNG KHAI. Đưa nhạc vào đây nghĩa là ai cũng tải
được file đó. Đừng dùng nhạc có bản quyền (nhạc thương mại, nhạc
phim, bản remix của người khác).

An toàn:
- Nhạc do bạn tự làm
- Nhạc CC0 / Public Domain (freesound.org lọc CC0)
- Nhạc có giấy phép cho phép tải lại tự do (CC BY, Pixabay,
  Free Music Archive lọc "Creative Commons")


GHI CÔNG TÁC GIẢ (tuỳ chọn nhưng nên làm)
-----------------------------------------
Nếu nhạc dùng giấy phép CC BY (bắt ghi công), ghi tên bài + tác giả
vào file CREDITS.txt trong thư mục này. Web có thể hiện dòng ghi công
nhỏ ở góc nếu bạn thêm tên file vào MUSIC_CREDITS trong
src/components/sanctuaryMusic.ts


CÁCH THÊM
---------
Cách 1 — trên web GitHub (không cần cài gì):
  1. Vào repo → thư mục public/music
  2. Bấm "Add file" → "Upload files"
  3. Kéo file nhạc vào, đặt tên đúng (sanctuary.mp3)
  4. Bấm "Commit changes"
  5. Đợi ~1 phút để GitHub Actions deploy lại

Cách 2 — trên máy:
  1. Copy file vào C:\Users\...\sn-phgt\public\music\
  2. git add public/music/sanctuary.mp3
  3. git commit -m "them nhac nen sanh"
  4. git push


KIỂM TRA ĐÃ CHẠY CHƯA
---------------------
Mở web, bấm vào bất kỳ đâu (trình duyệt chặn tự phát nhạc cho tới khi
người dùng bấm lần đầu). Nếu file đúng thì nghe đúng bài của bạn.
Sai tên file thì web vẫn chạy nhưng phát nhạc tổng hợp.

Kiểm tra file đã lên chưa bằng cách mở thẳng:
  https://longcaotien.github.io/sn-phgt/music/sanctuary.mp3
  → tải được file = đã lên đúng chỗ
  → 404 = chưa có hoặc sai tên
