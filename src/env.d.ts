/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    adminSession?: {
      issuedAt: number;
      expiresAt: number;
    };
  }
}

interface Window {
  __CSRF__?: string;
  adminToast?: (msg: string, type?: "info" | "success" | "error") => void;
}
