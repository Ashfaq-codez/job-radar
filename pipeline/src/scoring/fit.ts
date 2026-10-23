import { z } from "zod";

// The exact shape the AI must return. Same Zod you used for APIs.
// In its own file so tests and the notifier can use it without an OpenAI key.
export const FitSchema = z.object({
  score: z.number(),
  verdict: z.enum(["apply", "maybe", "skip"]),
  reasons: z.array(z.string()),
  missing: z.array(z.string()),
});
export type Fit = z.infer<typeof FitSchema>;
