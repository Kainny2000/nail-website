import { z } from "zod";

const EnvSchema = z.object({
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 chars (use: openssl rand -base64 32)"),
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD_HASH: z
    .string()
    .regex(/^\$2[aby]\$/, "ADMIN_PASSWORD_HASH must be a bcrypt hash (use: npm run hash-password)"),
  TRUSTED_PROXY: z.string().default("127.0.0.1"),
});

let cached = null;

export function getEnv() {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Environment configuration is invalid:\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the values.`
    );
  }
  cached = parsed.data;
  return cached;
}
