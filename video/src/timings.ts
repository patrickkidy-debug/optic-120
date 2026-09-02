export const FPS = 30;

// Decoupage en secondes (voir brief) -> frames. 30s pile, cale sur la voix-off.
export const SCENES = {
  problem: { from: 0, duration: 5 * FPS }, // 0-5s
  intro: { from: 5 * FPS, duration: 4 * FPS }, // 5-9s
  stock: { from: 9 * FPS, duration: 4 * FPS }, // 9-13s
  sales: { from: 13 * FPS, duration: 4 * FPS }, // 13-17s
  orders: { from: 17 * FPS, duration: 4 * FPS }, // 17-21s
  overview: { from: 21 * FPS, duration: 4 * FPS }, // 21-25s
  cta: { from: 25 * FPS, duration: 5 * FPS }, // 25-30s
} as const;

export const TOTAL_DURATION = SCENES.cta.from + SCENES.cta.duration; // 900 frames = 30s
