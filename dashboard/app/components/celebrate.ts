// A tiny confetti burst from a point on screen. Plain DOM + CSS, no library.
// Skipped entirely when the user prefers reduced motion.
const COLORS = ["var(--accent)", "var(--applied)", "var(--offer)", "var(--saved)", "var(--rejected)", "var(--spark)", "#f59e0b"];

export function celebrate(from?: HTMLElement | null) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = from?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const y = r ? r.top + r.height / 2 : window.innerHeight / 3;

  for (let i = 0; i < 28; i++) {
    const bit = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 90;
    bit.className = "confetti-bit";
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.background = COLORS[i % COLORS.length]!;
    bit.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    bit.style.setProperty("--dy", `${Math.sin(angle) * dist - 40}px`);
    bit.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
    if (i % 3 === 0) bit.style.borderRadius = "999px";
    document.body.appendChild(bit);
    bit.addEventListener("animationend", () => bit.remove());
  }
}
