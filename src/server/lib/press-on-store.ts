import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "./paths";

export type PressOnCard = {
  id: string;
  name: string;
  description: string;
  price: string;
  imageId: string;
  active: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type PressOnManifest = PressOnCard[];

let cache: PressOnManifest | null = null;
let cacheMtime = 0;

function filePath(): string {
  return path.join(PATHS.data, "press-on.json");
}

async function read(): Promise<PressOnManifest> {
  const fp = filePath();
  try {
    const raw = await fs.readFile(fp, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await fs.mkdir(PATHS.data, { recursive: true, mode: 0o700 });
      await fs.writeFile(fp, "[]", { mode: 0o600 });
      await fs.chmod(fp, 0o600);
      return [];
    }
    return [];
  }
}

async function write(data: PressOnManifest): Promise<void> {
  const fp = filePath();
  const tmp = fp + ".tmp";
  await fs.mkdir(PATHS.data, { recursive: true, mode: 0o700 });
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await fs.rename(tmp, fp);
  await fs.chmod(fp, 0o600);
  cache = data;
  cacheMtime = Date.now();
}

export async function getPressOnCards(): Promise<PressOnManifest> {
  const fp = filePath();
  let stat;
  try {
    stat = await fs.stat(fp);
  } catch {
    stat = null;
  }
  const mtime = stat?.mtimeMs ?? 0;
  if (cache && mtime === cacheMtime) return cache;
  cache = await read();
  cacheMtime = mtime;
  return cache;
}

export async function getPressOnCard(id: string): Promise<PressOnCard | null> {
  const cards = await getPressOnCards();
  return cards.find((c) => c.id === id) ?? null;
}

export async function createPressOnCard(
  data: Omit<PressOnCard, "id" | "createdAt" | "updatedAt">
): Promise<PressOnCard> {
  const cards = await getPressOnCards();
  const now = new Date().toISOString();
  const card: PressOnCard = {
    ...data,
    id: crypto.randomUUID().split("-")[0],
    createdAt: now,
    updatedAt: now,
  };
  cards.push(card);
  await write(cards);
  return card;
}

export async function updatePressOnCard(
  id: string,
  patch: Partial<Omit<PressOnCard, "id" | "createdAt">>
): Promise<PressOnCard | null> {
  const cards = await getPressOnCards();
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  cards[idx] = { ...cards[idx], ...patch, updatedAt: new Date().toISOString() };
  await write(cards);
  return cards[idx];
}

export async function deletePressOnCard(id: string): Promise<PressOnCard | null> {
  const cards = await getPressOnCards();
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const [removed] = cards.splice(idx, 1);
  await write(cards);
  return removed;
}

export async function reorderPressOnCards(ids: string[]): Promise<PressOnManifest> {
  const cards = await getPressOnCards();
  const byId = new Map(cards.map((c) => [c.id, c]));
  const reordered: PressOnManifest = [];
  for (const id of ids) {
    const card = byId.get(id);
    if (card) {
      card.order = reordered.length;
      reordered.push(card);
      byId.delete(id);
    }
  }
  for (const leftover of byId.values()) {
    leftover.order = reordered.length;
    reordered.push(leftover);
  }
  await write(reordered);
  return reordered;
}