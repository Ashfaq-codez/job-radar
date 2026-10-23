import { connection } from "next/server";
import { Suspense } from "react";

// A fresh one on every page load
const QUOTES = [
  "Every application is a step forward, even the quiet ones.",
  "You don’t need to be ready. You need to start.",
  "The right team is looking for someone exactly like you.",
  "Small progress every day adds up to big results.",
  "Your first role is out there. Keep showing up for it.",
  "Rejections redirect you. They don’t define you.",
  "You’ve learned hard things before. This is one more.",
  "Consistency beats intensity. One good application today is enough.",
  "Be proud of how far you’ve come, then go a little further.",
  "Curiosity and effort are your superpowers. Use both today.",
  "Somewhere, a hiring manager is hoping someone like you applies.",
  "Done is better than perfect. Hit send.",
  "Each “no” brings you closer to the “yes” that fits.",
  "Keep building. Every project makes your story stronger.",
  "Take a breath. You’re doing better than you think.",
  "Great careers start with brave first steps.",
];

function randomQuote(): string {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]!;
}

async function Motivation() {
  await connection();
  const quote = randomQuote();
  return (
    <section className="rounded-2xl bg-gradient-to-br from-spark/20 to-transparent bg-white/[0.07] p-4 ring-1 ring-white/10">
      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-spark">
        <span aria-hidden="true">✨</span> Keep going
      </h2>
      <p className="mt-2 text-sm leading-relaxed">{quote}</p>
    </section>
  );
}

export function SidebarCards() {
  return (
    <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl bg-white/[0.07]" />}>
      <Motivation />
    </Suspense>
  );
}
