import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { PATHS } from "./paths";

export type ManifestItem = {
  id: string;
  filename: string;
  alt: string;
  addedAt: string;
  sections: string[];
};

export type Manifest = ManifestItem[];

let cache: Manifest | null = null;
let cacheMtime = 0;

async function ensureDirs() {
  await fs.mkdir(PATHS.data, { recursive: true, mode: 0o700 });
  await fs.mkdir(PATHS.uploads, { recursive: true, mode: 0o700 });
  await fs.mkdir(PATHS.logs, { recursive: true, mode: 0o700 });
}

function migrateItem(item: Record<string, unknown>): ManifestItem {
  return {
    id: String(item.id ?? ""),
    filename: String(item.filename ?? ""),
    alt: String(item.alt ?? "Nail Art"),
    addedAt: String(item.addedAt ?? new Date().toISOString()),
    sections: Array.isArray(item.sections) ? item.sections : ["slideshow"],
  };
}

async function readManifestFromDisk(): Promise<Manifest> {
  await ensureDirs();
  const file = PATHS.manifest();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("manifest.json must be a JSON array");
    }
    return parsed.map((item) => {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof item.id !== "string" ||
        typeof item.filename !== "string"
      ) {
        throw new Error("manifest.json has invalid entries");
      }
      return migrateItem(item as Record<string, unknown>);
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await fs.writeFile(file, "[]", { mode: 0o600 });
      await fs.chmod(file, 0o600);
      return [];
    }
    throw err;
  }
}

export async function getManifest(): Promise<Manifest> {
  const file = PATHS.manifest();
  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    stat = null;
  }
  const mtime = stat?.mtimeMs ?? 0;
  if (cache && mtime === cacheMtime) return cache;
  cache = await readManifestFromDisk();
  cacheMtime = mtime;
  return cache;
}

export async function getManifestBySection(section: string): Promise<Manifest> {
  const m = await getManifest();
  return m.filter((x) => x.sections.includes(section));
}

export async function getManifestItem(id: string): Promise<ManifestItem | null> {
  const m = await getManifest();
  return m.find((x) => x.id === id) ?? null;
}

async function writeManifest(next: Manifest) {
  await ensureDirs();
  const file = PATHS.manifest();
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
  await fs.chmod(file, 0o600);
  cache = next;
  cacheMtime = Date.now();
}

export async function appendManifestItem(item: ManifestItem) {
  const m = await getManifest();
  const next = [item, ...m];
  await writeManifest(next);
  return next;
}

export async function updateManifestItem(
  id: string,
  patch: Partial<Pick<ManifestItem, "alt" | "sections">>
) {
  const m = await getManifest();
  const idx = m.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const updated = { ...m[idx], ...patch };
  const next = [...m];
  next[idx] = updated;
  await writeManifest(next);
  return updated;
}

export async function removeManifestItem(id: string) {
  const m = await getManifest();
  const item = m.find((x) => x.id === id);
  if (!item) return null;
  const next = m.filter((x) => x.id !== id);
  await writeManifest(next);
  return item;
}

export async function reorderManifest(ids: string[]) {
  const m = await getManifest();
  const byId = new Map(m.map((x) => [x.id, x]));
  const next: Manifest = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item) {
      next.push(item);
      byId.delete(id);
    }
  }
  for (const leftover of byId.values()) next.push(leftover);
  await writeManifest(next);
  return next;
}

export function uploadPath(filename: string): string {
  return path.join(PATHS.uploads, filename);
}

export async function unlinkUpload(filename: string) {
  const p = uploadPath(filename);
  try {
    await fs.unlink(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export function uploadsDirExists(): boolean {
  try {
    return fsSync.statSync(PATHS.uploads).isDirectory();
  } catch {
    return false;
  }
}