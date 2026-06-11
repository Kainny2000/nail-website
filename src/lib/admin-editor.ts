import Sortable from 'sortablejs';

export interface DragOptions {
  group: string;
  handle?: string;
  filter?: string;
  preventOnFilter?: boolean;
  onUpdate?: (e: Sortable.SortableEvent) => void;
  onAdd?: (e: Sortable.SortableEvent) => void;
  onRemove?: (e: Sortable.SortableEvent) => void;
  onEnd?: (e: Sortable.SortableEvent) => void;
}

export function mountDragDrop(zone: HTMLElement, opts: DragOptions): Sortable {
  return new Sortable(zone, {
    group: opts.group,
    animation: 150,
    handle: opts.handle,
    filter: opts.filter,
    preventOnFilter: opts.preventOnFilter ?? false,
    ghostClass: 'ce-card-ghost',
    onUpdate: opts.onUpdate,
    onAdd: opts.onAdd,
    onRemove: opts.onRemove,
    onEnd: opts.onEnd,
  });
}

export function makeDirtyTracker(saveBtn: HTMLElement | null, indicator: HTMLElement | null) {
  let dirty = false;
  const mark = () => {
    dirty = true;
    if (indicator) indicator.hidden = true;
    saveBtn?.classList.add('btn-primary');
  };
  const clean = () => {
    dirty = false;
    if (indicator) indicator.hidden = false;
    saveBtn?.classList.remove('btn-primary');
  };
  const isDirty = () => dirty;
  window.addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  return { mark, clean, isDirty };
}

export function mountPreviewToggle(button: HTMLElement, frame: HTMLElement, hideLabel = '👁 Preview', showLabel = '✕ Cerrar preview') {
  button.addEventListener('click', () => {
    const willShow = frame.hidden;
    frame.hidden = !willShow;
    button.textContent = willShow ? showLabel : hideLabel;
  });
}

export function reloadPreview(frame: HTMLElement | null) {
  const iframe = document.getElementById('admin-preview-iframe') as HTMLIFrameElement | null;
  if (iframe && frame && !frame.hidden) {
    iframe.src = iframe.src.split('?')[0] + '?t=' + Date.now();
  }
}

export async function api<T = any>(method: string, url: string, body?: any): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(body);
    }
  }
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status}`);
  return r.json();
}

export function reloadImagesList(state: { images: any[] }): Promise<void> {
  return api<{ images: any[] }>('GET', '/api/admin/images').then((data) => {
    state.images = data.images;
  });
}
