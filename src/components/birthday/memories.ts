export type MemoryBubbleItem = {
  id: number;
  src: string;
  caption: string;
  date?: string;
};

const BASE = import.meta.env.BASE_URL ?? "/";

/**
 * Để tự thêm ảnh kỷ niệm:
 * 1. Đặt ảnh vào thư mục `public/memories/` (vd: anh1.jpg, anh2.jpg, anh3.jpg, anh4.jpg)
 * 2. Hoặc chỉnh sửa trực tiếp danh sách bên dưới.
 */
export const MEMORIES: MemoryBubbleItem[] = [
  { id: 1, src: `${BASE}memories/anh1.jpg`, caption: "Khoảnh khắc đáng nhớ #1", date: "30/11" },
  { id: 2, src: `${BASE}memories/anh2.jpg`, caption: "Những ngày thật vui #2", date: "30/11" },
  { id: 3, src: `${BASE}memories/anh3.jpg`, caption: "Kỷ niệm khó quên #3", date: "30/11" },
  { id: 4, src: `${BASE}memories/anh4.jpg`, caption: "Tuổi mới rực rỡ #4", date: "30/11" },
];
