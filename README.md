# sn-phgt — Happy Birthday Gia Trí | Solo Leveling

Website sinh nhật Solo Leveling (React + Vite + Tailwind), deploy lên GitHub Pages.

**Live:** https://longcaotien.github.io/sn-phgt/

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
