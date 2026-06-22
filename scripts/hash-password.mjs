#!/usr/bin/env node
// Generate a bcrypt hash for ADMIN_PASSWORD_HASH.
// Usage: npm run hash-password -- "your-password-here"
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run hash-password -- \"your-password\"");
  process.exit(1);
}
if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(hash);
