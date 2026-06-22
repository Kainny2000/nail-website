/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    session: { uid: string; login: string; totpVerified: true; iat: number; nonce: string } | null;
    pre: { uid: string; login: string; iat: number } | null;
    ip: string;
    needsLogin?: boolean;
  }
}
