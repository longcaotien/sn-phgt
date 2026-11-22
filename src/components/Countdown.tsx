import { useEffect, useState } from "react";

function nextBirthday(now: Date) {
  let y = now.getFullYear();
  let d = new Date(y, 10, 30, 0, 0, 0); // 30/11
  const endOfDay = new Date(y, 10, 30, 23, 59, 59);
  if (now > endOfDay) d = new Date(y + 1, 10, 30, 0, 0, 0);
  return d;
}

export default function Countdown() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isToday = now.getDate() === 30 && now.getMonth() === 10;
  if (isToday) {
    return (
      <div className="font-sys text-xs tracking-[0.3em] text-sky-200 text-glow sm:text-sm">
        ★ HÔM NAY LÀ NGÀY SINH NHẬT – CỔNG ĐÃ MỞ ★
      </div>
    );
  }

  const diff = Math.max(0, nextBirthday(now).getTime() - now.getTime());
  const parts = [
    ["NGÀY", Math.floor(diff / 864e5)],
    ["GIỜ", Math.floor(diff / 36e5) % 24],
    ["PHÚT", Math.floor(diff / 6e4) % 60],
    ["GIÂY", Math.floor(diff / 1e3) % 60],
  ] as const;

  return (
    <div>
      <div className="mb-2 font-sys text-[10px] tracking-[0.35em] text-sky-300/70">CỔNG DUNGEON MỞ SAU</div>
      <div className="flex gap-2 sm:gap-3">
        {parts.map(([label, v]) => (
          <div key={label} className="sys-panel sys-cut relative min-w-[58px] overflow-hidden px-2 py-2 text-center sm:min-w-[70px]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
            <div className="font-sys text-xl font-bold text-white text-glow sm:text-2xl">
              {String(v).padStart(2, "0")}
            </div>
            <div className="font-sys text-[8px] tracking-[0.25em] text-sky-300/80">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
