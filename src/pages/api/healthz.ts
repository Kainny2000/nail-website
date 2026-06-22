import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
};
