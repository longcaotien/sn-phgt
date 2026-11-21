import { motion } from "framer-motion";

export type Gaze = "none" | "warn" | "on";
export type Attack = "none" | "warn" | "strike";

type Props = {
  src: string;
  x: number; // % theo chiều ngang
  bottom: string;
  height: string;
  eye: [number, number]; // vị trí mắt (% trong ảnh)
  revealed: boolean;
  revealDelay: number;
  awake: boolean;
  shattered: boolean;
  gaze: Gaze;
  attack: Attack;
};

export default function Statue({
  src,
  x,
  bottom,
  height,
  eye,
  revealed,
  revealDelay,
  awake,
  shattered,
  gaze,
  attack,
}: Props) {
  const action = shattered
    ? { y: "7vh", scale: 0.86, opacity: 0, filter: "blur(14px) brightness(2.2)", transition: { duration: 1.8, ease: "easeIn" as const } }
    : attack === "strike"
    ? { y: "4.5vh", scale: 1.1, opacity: 1, filter: "blur(0px) brightness(1.7)", transition: { duration: 0.1, ease: "easeIn" as const } }
    : attack === "warn"
    ? { y: "-1.6vh", scale: 1.05, opacity: 1, filter: "blur(0px) brightness(1.35)", transition: { duration: 0.9, ease: "easeOut" as const } }
    : { y: 0, scale: 1, opacity: 1, filter: "blur(0px) brightness(1)", transition: { duration: 0.5 } };

  const eyeOn = awake || gaze === "on";
  const eyeWarn = gaze === "warn";

  return (
    <div className="pointer-events-none absolute z-10" style={{ left: `${x}%`, bottom, height, aspectRatio: "2/3", transform: "translateX(-50%)" }}>
      <motion.div
        className="relative h-full w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: revealed ? [0, 1, 0.15, 1, 0.45, 1] : 0 }}
        transition={{ duration: revealed ? 1.6 : 0.2, delay: revealed ? revealDelay : 0 }}
      >
        <motion.div className="relative h-full w-full origin-bottom" animate={action}>
          <img
            src={src}
            alt=""
            draggable={false}
            className="h-full w-full select-none object-contain"
            style={{
              mixBlendMode: "screen",
              filter: awake
                ? "hue-rotate(125deg) saturate(2.2) drop-shadow(0 0 22px rgba(255,70,30,.75))"
                : "drop-shadow(0 0 20px rgba(90,150,255,.6))",
              transition: "filter 1.8s ease",
            }}
          />
          {/* mắt */}
          <div
            className={`absolute rounded-full mix-blend-screen ${eyeWarn ? "eye-flicker" : ""}`}
            style={{
              left: `${eye[0]}%`,
              top: `${eye[1]}%`,
              width: "20%",
              height: "4%",
              transform: "translate(-50%,-50%)",
              background: eyeOn
                ? "radial-gradient(ellipse, rgba(255,80,60,1), rgba(255,30,30,.55) 45%, rgba(255,0,0,0) 75%)"
                : eyeWarn
                ? "radial-gradient(ellipse, rgba(255,200,90,.95), rgba(255,140,40,.4) 50%, rgba(255,120,0,0) 75%)"
                : "radial-gradient(ellipse, rgba(120,170,255,.45), rgba(120,170,255,0) 70%)",
              filter: "blur(3px)",
              opacity: eyeOn ? 1 : eyeWarn ? 0.9 : 0.55,
              transition: "opacity .3s",
            }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
