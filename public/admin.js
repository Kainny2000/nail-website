const CSRF = document.cookie.split("; ").find(r => r.startsWith("__nail_csrf="))?.split("=")[1] ?? "";
var isTouchDevice = "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;

function doLogout() {
  fetch("/api/auth/logout", {
    method: "POST",
    headers: { "X-CSRF-Token": CSRF, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then(function() {
    window.location.href = "/admin";
  });
}

function toast(msg, type) {
  type = type || "info";
  var c = document.getElementById("toast-container");
  var el = document.createElement("div");
  el.className = "toast toast-" + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(function() {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s";
    setTimeout(function() { el.remove(); }, 300);
  }, 3000);
}

document.querySelectorAll(".admin-tab").forEach(function(tab) {
  tab.addEventListener("click", function() {
    document.querySelectorAll(".admin-tab").forEach(function(t) { t.classList.remove("active"); });
    tab.classList.add("active");
    document.querySelectorAll(".tab-content").forEach(function(tc) { tc.classList.remove("active"); });
    var target = document.getElementById(tab.dataset.tab);
    if (target) target.classList.add("active");
    if (tab.dataset.tab === "tab-manager") loadImageGrid();
    if (tab.dataset.tab === "tab-presson") loadPressOn();
  });
});

var uploadZone = document.getElementById("upload-zone");
var fileInput = document.getElementById("file-input");
var previewList = document.getElementById("preview-list");
var progressBar = document.getElementById("progress-bar");
var progressFill = document.getElementById("progress-fill");
var uploadErrors = document.getElementById("upload-errors");
var btnUpload = document.getElementById("btn-upload");
var btnClear = document.getElementById("btn-clear-upload");
var pendingFiles = [];

if (uploadZone) {
  uploadZone.addEventListener("click", function() { fileInput.click(); });
  uploadZone.addEventListener("dragover", function(e) { e.preventDefault(); uploadZone.classList.add("drag-over"); });
  uploadZone.addEventListener("dragleave", function() { uploadZone.classList.remove("drag-over"); });
  uploadZone.addEventListener("drop", function(e) {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    addFiles(Array.from(e.dataTransfer.files));
  });
  fileInput.addEventListener("change", function() { addFiles(Array.from(fileInput.files)); });
}

function addFiles(files) {
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var dup = pendingFiles.some(function(p) { return p.name === f.name && p.size === f.size; });
    if (dup) continue;
    if (f.size > 8 * 1024 * 1024) { toast(f.name + " is too large (>8MB)", "error"); continue; }
    pendingFiles.push(f);
  }
  renderPreviews();
}

function removeFile(idx) { pendingFiles.splice(idx, 1); renderPreviews(); }

function renderPreviews() {
  btnUpload.disabled = pendingFiles.length === 0;
  btnClear.style.display = pendingFiles.length > 0 ? "inline-flex" : "none";
  var html = "";
  for (var i = 0; i < pendingFiles.length; i++) {
    var f = pendingFiles[i];
    var url = URL.createObjectURL(f);
    html += '<div class="upload-preview-item"><img src="' + url + '" alt="' + f.name + '" /><button class="upload-preview-remove" data-idx="' + i + '">&times;</button><div class="upload-preview-name">' + f.name + '</div></div>';
  }
  previewList.innerHTML = html;
  previewList.querySelectorAll(".upload-preview-remove").forEach(function(btn) {
    btn.addEventListener("click", function(e) { e.stopPropagation(); removeFile(parseInt(btn.dataset.idx)); });
  });
}

if (btnClear) btnClear.addEventListener("click", function() { pendingFiles = []; renderPreviews(); fileInput.value = ""; });

if (btnUpload) btnUpload.addEventListener("click", async function() {
  if (pendingFiles.length === 0) return;
  var checked = document.querySelectorAll("input[name='upload-sections']:checked");
  var sections = Array.from(checked).map(function(cb) { return cb.value; }).join(",") || "slideshow,gallery,presson";
  var alt = document.getElementById("upload-alt").value.trim();
  progressBar.style.display = "block";
  progressFill.style.width = "0%";
  uploadErrors.innerHTML = "";
  btnUpload.disabled = true;
  var uploaded = 0;
  var errors = [];
  for (var i = 0; i < pendingFiles.length; i++) {
    var file = pendingFiles[i];
    try {
      var fd = new FormData();
      fd.append("file", file);
      fd.append("alt", alt);
      fd.append("sections", sections);
      var res = await fetch("/api/images", { method: "POST", headers: { "X-CSRF-Token": CSRF }, body: fd });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      uploaded++;
      progressFill.style.width = ((uploaded / pendingFiles.length) * 100) + "%";
    } catch (err) { errors.push({ filename: file.name, error: err.message }); }
  }
  if (uploaded > 0) toast("Uploaded " + uploaded + " image" + (uploaded > 1 ? "s" : ""), "success");
  if (errors.length > 0) {
    uploadErrors.innerHTML = errors.map(function(e) { return '<div class="upload-error-item">' + e.filename + ': ' + e.error + '</div>'; }).join("");
  }
  progressBar.style.display = "none";
  btnUpload.disabled = false;
  pendingFiles = [];
  renderPreviews();
  fileInput.value = "";
  document.getElementById("upload-alt").value = "";
});

var allImages = [];
var dragOrderChanged = false;
var desktopDragging = false;
var imageGrid = document.getElementById("image-grid");
var batchActions = document.getElementById("batch-actions");
var batchCount = document.getElementById("batch-count");

var autoScrollTimer = null;
var SCROLL_ZONE = 80;
var SCROLL_MAX_SPEED = 120;

function toggleImageSelection(img, card) { img.selected = !img.selected; card.classList.toggle("selected", img.selected); updateBatchUI(); }

function updateBatchUI() {
  var selected = allImages.filter(function(i) { return i.selected; });
  if (batchActions) batchActions.classList.toggle("visible", selected.length > 0);
  if (batchCount) batchCount.textContent = selected.length + " selected";
}

function updateSaveOrderButton() {
  var btn = document.getElementById("btn-save-order");
  if (btn) btn.disabled = !dragOrderChanged;
}

var btnSaveOrder = document.getElementById("btn-save-order");
if (btnSaveOrder) btnSaveOrder.addEventListener("click", async function() {
  if (!dragOrderChanged) return;
  var ids = allImages.map(function(i) { return i.id; });
  try {
    var res = await fetch("/api/images/order", {
      method: "PUT", headers: { "Content-Type": "application/json", "X-CSRF-Token": CSRF },
      body: JSON.stringify({ order: ids }),
    });
    if (!res.ok) throw new Error("Failed");
    dragOrderChanged = false;
    updateSaveOrderButton();
    toast("Order saved", "success");
  } catch (err) { toast("Failed to save order", "error"); }
});

async function loadImageGrid() {
  if (allImages.length > 0) { renderImageGrid(); return; }
  try {
    var res = await fetch("/api/images");
    if (!res.ok) throw new Error("Failed");
    var data = await res.json();
    allImages = data.items.map(function(i) { i.selected = false; return i; });
    renderImageGrid();
  } catch (err) { if (imageGrid) imageGrid.innerHTML = '<div class="empty-state">Failed to load</div>'; }
}

function renderImageGrid() {
  if (!imageGrid) return;
  if (allImages.length === 0) { imageGrid.innerHTML = '<div class="empty-state">No images yet. Upload some first.</div>'; return; }
  var html = "";
  for (var idx = 0; idx < allImages.length; idx++) {
    var img = allImages[idx];
    var barns = ["slideshow","gallery","presson"].map(function(s) {
      var on = img.sections.indexOf(s) >= 0;
      return '<span class="section-badge ' + (on ? 'section-badge-on' : 'section-badge-off') + '" data-idx="' + idx + '" data-section="' + s + '">' + s + '</span>';
    }).join("");
    html += '<div class="image-card ' + (img.selected ? 'selected' : '') + '" data-idx="' + idx + '" draggable="' + (!isTouchDevice) + '">' +
      '<span class="drag-handle" data-drag-handle="true"></span>' +
      '<img class="image-card-thumb" src="' + img.url + '" alt="' + img.alt + '" loading="lazy" />' +
      '<div class="image-card-body">' +
      '<div class="image-card-name" title="' + img.filename + '">' + img.filename + '</div>' +
      '<div class="image-card-sections">' + barns + '</div>' +
      '<div class="image-card-actions">' +
        '<button class="btn btn-secondary btn-sm btn-delete" data-idx="' + idx + '">Delete</button>' +
      '</div>' +
      '<div class="image-card-alt" data-idx="' + idx + '" title="Click to edit alt text">' + (img.alt || 'Click to edit alt') + '</div>' +
      '</div></div>';
  }
  imageGrid.innerHTML = html;

  var draggedIdx = -1;

  imageGrid.querySelectorAll(".image-card").forEach(function(card) {
    card.addEventListener("click", function(e) {
      if (e.target.closest(".section-badge, .btn, .image-card-alt, .drag-handle")) return;
      var idx = parseInt(card.dataset.idx);
      toggleImageSelection(allImages[idx], card);
    });

    card.addEventListener("dragstart", function(e) {
      if (e.target.closest(".section-badge, .btn, .image-card-alt")) { e.preventDefault(); return; }
      draggedIdx = parseInt(card.dataset.idx);
      desktopDragging = true;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(draggedIdx));
    });

    card.addEventListener("dragend", function() {
      card.classList.remove("dragging");
      imageGrid.querySelectorAll(".image-card").forEach(function(c) { c.classList.remove("drag-over"); });
      draggedIdx = -1;
      desktopDragging = false;
      stopAutoScroll();
    });

    card.addEventListener("dragover", function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      var targetIdx = parseInt(card.dataset.idx);
      if (targetIdx !== draggedIdx) card.classList.add("drag-over");
    });

    card.addEventListener("dragleave", function() { card.classList.remove("drag-over"); });

    card.addEventListener("drop", function(e) {
      e.preventDefault();
      card.classList.remove("drag-over");
      stopAutoScroll();
      desktopDragging = false;
      var targetIdx = parseInt(card.dataset.idx);
      if (targetIdx === draggedIdx || draggedIdx === -1) return;
      var dragged = allImages[draggedIdx];
      allImages.splice(draggedIdx, 1);
      allImages.splice(targetIdx, 0, dragged);
      dragOrderChanged = true;
      updateSaveOrderButton();
      renderImageGrid();
    });
  });

  imageGrid.querySelectorAll(".section-badge").forEach(function(badge) {
    badge.addEventListener("click", async function(e) {
      e.stopPropagation();
      var idx = parseInt(badge.dataset.idx);
      var section = badge.dataset.section;
      var img = allImages[idx];
      var sections;
      if (img.sections.indexOf(section) >= 0) {
        sections = img.sections.filter(function(s) { return s !== section; });
      } else {
        sections = img.sections.concat([section]);
      }
      if (sections.length === 0) { toast("Image must belong to at least one section", "error"); return; }
      try {
        var res = await fetch("/api/images/" + img.id, {
          method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": CSRF },
          body: JSON.stringify({ sections: sections }),
        });
        if (!res.ok) throw new Error("Failed");
        img.sections = sections; renderImageGrid();
      } catch (err) { toast("Failed to update sections", "error"); }
    });
  });

  imageGrid.querySelectorAll(".btn-delete").forEach(function(btn) {
    btn.addEventListener("click", async function(e) {
      e.stopPropagation();
      var idx = parseInt(btn.dataset.idx);
      var img = allImages[idx];
      if (!confirm('Delete "' + img.filename + '"? This cannot be undone.')) return;
      try {
        var res = await fetch("/api/images/" + img.id, { method: "DELETE", headers: { "X-CSRF-Token": CSRF } });
        if (!res.ok) throw new Error("Failed");
        allImages.splice(idx, 1); renderImageGrid(); toast("Image deleted", "info");
      } catch (err) { toast("Failed to delete", "error"); }
    });
  });

  imageGrid.querySelectorAll(".image-card-alt").forEach(function(alt) {
    alt.addEventListener("click", async function(e) {
      e.stopPropagation();
      var idx = parseInt(alt.dataset.idx);
      var img = allImages[idx];
      var newAlt = prompt("Edit alt text:", img.alt || "");
      if (newAlt === null) return;
      try {
        var res = await fetch("/api/images/" + img.id, {
          method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": CSRF },
          body: JSON.stringify({ alt: newAlt }),
        });
        if (!res.ok) throw new Error("Failed");
        img.alt = newAlt; renderImageGrid(); toast("Alt text updated", "success");
      } catch (err) { toast("Failed to update", "error"); }
    });
  });
  updateBatchUI();
  updateSaveOrderButton();
}

function handleAutoScroll(clientY) {
  var vh = window.innerHeight;
  var maxScroll = document.documentElement.scrollHeight - vh;
  if (clientY < SCROLL_ZONE) {
    var speed = Math.round((SCROLL_ZONE - clientY) / SCROLL_ZONE * SCROLL_MAX_SPEED);
    startAutoScroll(-speed);
  } else if (clientY > vh - SCROLL_ZONE) {
    var speed = Math.round((clientY - (vh - SCROLL_ZONE)) / SCROLL_ZONE * SCROLL_MAX_SPEED);
    startAutoScroll(speed);
  } else {
    stopAutoScroll();
  }
}

function startAutoScroll(speed) {
  if (autoScrollTimer) return;
  autoScrollTimer = setInterval(function() {
    window.scrollBy(0, speed);
  }, 16);
}

function stopAutoScroll() {
  if (autoScrollTimer) {
    clearInterval(autoScrollTimer);
    autoScrollTimer = null;
  }
}

var touchDrag = { timer: null, idx: -1, clone: null, sx: 0, sy: 0, moved: false, active: false };

function initTouchImageDrag() {
  if (!isTouchDevice || !imageGrid) return;

  imageGrid.addEventListener("touchstart", function(e) {
    var card = e.target.closest(".image-card");
    if (!card || e.target.closest(".btn, .section-badge, .image-card-alt")) return;
    var t = e.touches[0];
    touchDrag.idx = parseInt(card.dataset.idx);
    touchDrag.sx = t.clientX;
    touchDrag.sy = t.clientY;
    touchDrag.moved = false;
    touchDrag.active = false;
    clearTimeout(touchDrag.timer);
    touchDrag.timer = setTimeout(function() {
      touchDrag.active = true;
      card.classList.add("touch-dragging");
      var rect = card.getBoundingClientRect();
      var cloneEl = card.cloneNode(true);
      cloneEl.classList.add("touch-drag-clone");
      cloneEl.style.position = "fixed";
      cloneEl.style.left = rect.left + "px";
      cloneEl.style.top = rect.top + "px";
      cloneEl.style.width = rect.width + "px";
      cloneEl.style.zIndex = "9999";
      cloneEl.style.pointerEvents = "none";
      cloneEl.style.transition = "none";
      document.body.appendChild(cloneEl);
      touchDrag.clone = cloneEl;
    }, 400);
  }, { passive: true });

  imageGrid.addEventListener("touchmove", function(e) {
    if (!touchDrag.active || !touchDrag.clone) return;
    e.preventDefault();
    var t = e.touches[0];
    touchDrag.moved = true;
    handleAutoScroll(t.clientY);
    var w = touchDrag.clone.offsetWidth;
    touchDrag.clone.style.left = (t.clientX - w / 2) + "px";
    touchDrag.clone.style.top = (t.clientY - 50) + "px";

    imageGrid.querySelectorAll(".image-card").forEach(function(c) { c.classList.remove("touch-drag-over"); });
    touchDrag.clone.style.display = "none";
    var el = document.elementFromPoint(t.clientX, t.clientY);
    touchDrag.clone.style.display = "";
    var targetCard = el ? el.closest(".image-card") : null;
    if (targetCard && parseInt(targetCard.dataset.idx) !== touchDrag.idx) {
      targetCard.classList.add("touch-drag-over");
    }
  }, { passive: false });

  imageGrid.addEventListener("touchend", function(e) {
    clearTimeout(touchDrag.timer);
    stopAutoScroll();
    if (touchDrag.clone) { touchDrag.clone.remove(); touchDrag.clone = null; }

    imageGrid.querySelectorAll(".image-card").forEach(function(c) { c.classList.remove("touch-dragging", "touch-drag-over"); });

    if (!touchDrag.active || !touchDrag.moved) { touchDrag.idx = -1; touchDrag.active = false; return; }

    var t = e.changedTouches[0];
    var el = document.elementFromPoint(t.clientX, t.clientY);
    var targetCard = el ? el.closest(".image-card") : null;
    var targetIdx = targetCard ? parseInt(targetCard.dataset.idx) : -1;

    if (targetIdx >= 0 && targetIdx !== touchDrag.idx) {
      var item = allImages.splice(touchDrag.idx, 1)[0];
      allImages.splice(targetIdx, 0, item);
      dragOrderChanged = true;
      updateSaveOrderButton();
      renderImageGrid();
    }

    touchDrag.idx = -1;
    touchDrag.active = false;
    touchDrag.moved = false;
  });

  imageGrid.addEventListener("touchcancel", function() {
    clearTimeout(touchDrag.timer);
    stopAutoScroll();
    if (touchDrag.clone) { touchDrag.clone.remove(); touchDrag.clone = null; }
    imageGrid.querySelectorAll(".image-card").forEach(function(c) { c.classList.remove("touch-dragging", "touch-drag-over"); });
    touchDrag.idx = -1;
    touchDrag.active = false;
    touchDrag.moved = false;
  });
}

initTouchImageDrag();

document.addEventListener("dragover", function(e) {
  if (!desktopDragging) return;
  handleAutoScroll(e.clientY);
});

document.addEventListener("dragend", function() {
  stopAutoScroll();
  desktopDragging = false;
});

var btnBatchDelete = document.getElementById("btn-batch-delete");
if (btnBatchDelete) btnBatchDelete.addEventListener("click", async function() {
  var selected = allImages.filter(function(i) { return i.selected; });
  if (selected.length === 0) return;
  if (!confirm("Delete " + selected.length + " image" + (selected.length > 1 ? "s" : "") + "? This cannot be undone.")) return;
  var deleted = 0;
  for (var i = 0; i < selected.length; i++) {
    try { await fetch("/api/images/" + selected[i].id, { method: "DELETE", headers: { "X-CSRF-Token": CSRF } }); deleted++; } catch (err) {}
  }
  allImages = allImages.filter(function(i) { return !i.selected; });
  renderImageGrid();
  toast("Deleted " + deleted + " image" + (deleted > 1 ? "s" : ""), "info");
});

var btnBatchSections = document.getElementById("btn-batch-sections");
if (btnBatchSections) btnBatchSections.addEventListener("click", async function() {
  var selected = allImages.filter(function(i) { return i.selected; });
  if (selected.length === 0) return;
  var input = prompt("Enter sections (slideshow,gallery,presson):");
  if (!input) return;
  var parts = input.split(",").map(function(s) { return s.trim().toLowerCase(); }).filter(function(s) {
    return s === "slideshow" || s === "gallery" || s === "presson";
  });
  if (parts.length === 0) { toast("No valid sections", "error"); return; }
  var updated = 0;
  for (var i = 0; i < selected.length; i++) {
    try {
      await fetch("/api/images/" + selected[i].id, {
        method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": CSRF },
        body: JSON.stringify({ sections: parts }),
      });
      selected[i].sections = parts; updated++;
    } catch (err) {}
  }
  renderImageGrid(); toast("Updated " + updated + " image" + (updated > 1 ? "s" : ""), "success");
});

var pressOnCards = [];
var pressOnImages = [];
var poDragOrderChanged = false;

function updatePoSaveOrderButton() {
  var btn = document.getElementById("btn-po-save-order");
  if (btn) btn.disabled = !poDragOrderChanged;
}

var btnPoSaveOrder = document.getElementById("btn-po-save-order");
if (btnPoSaveOrder) btnPoSaveOrder.addEventListener("click", async function() {
  if (!poDragOrderChanged) return;
  var ids = pressOnCards.map(function(c) { return c.id; });
  try {
    var res = await fetch("/api/press-on/order", {
      method: "PUT", headers: { "Content-Type": "application/json", "X-CSRF-Token": CSRF },
      body: JSON.stringify({ order: ids }),
    });
    if (!res.ok) throw new Error("Failed");
    poDragOrderChanged = false;
    updatePoSaveOrderButton();
    toast("Card order saved", "success");
  } catch (err) { toast("Failed to save card order", "error"); }
});

async function loadPressOn() {
  try {
    var cardsRes = await fetch("/api/press-on");
    var imgsRes = await fetch("/api/images");
    pressOnCards = ((await cardsRes.json()).items) || [];
    pressOnImages = ((await imgsRes.json()).items || []).filter(function(i) { return (i.sections || []).indexOf("presson") >= 0; });
    renderPressOnList(); renderImagePicker();
  } catch (err) {
    var list = document.getElementById("presson-list");
    if (list) list.innerHTML = '<div class="empty-state">Failed to load</div>';
  }
}

function renderImagePicker() {
  var picker = document.getElementById("po-image-picker");
  if (!picker) return;
  var html = "";
  for (var i = 0; i < pressOnImages.length; i++) {
    var img = pressOnImages[i];
    html += '<img class="image-picker-item" src="' + img.url + '" alt="' + img.alt + '" data-id="' + img.id + '" />';
  }
  if (html === "") html = '<span style="color:var(--admin-muted);font-size:0.8rem;padding:8px">No images with "presson" section</span>';
  picker.innerHTML = html;
  picker.querySelectorAll(".image-picker-item").forEach(function(el) {
    el.addEventListener("click", function() {
      picker.querySelectorAll(".image-picker-item").forEach(function(x) { x.classList.remove("selected"); });
      el.classList.add("selected");
      document.getElementById("po-imageId").value = el.dataset.id;
    });
  });
}

function renderPressOnList() {
  var list = document.getElementById("presson-list");
  if (!list) return;
  if (!pressOnCards.length) { list.innerHTML = '<div class="empty-state">No cards yet. Create one above.</div>'; return; }
  var html = "";
  for (var i = 0; i < pressOnCards.length; i++) {
    var c = pressOnCards[i];
    var img = null;
    for (var j = 0; j < pressOnImages.length; j++) {
      if (pressOnImages[j].id === c.imageId) { img = pressOnImages[j]; break; }
    }
    var thumb = img ? '<img class="presson-card-thumb" src="' + img.url + '" alt="' + c.name + '" />' : '<div class="presson-card-thumb-placeholder">No image</div>';
    html += '<div class="presson-card-item" data-idx="' + i + '" draggable="' + (!isTouchDevice) + '">' +
      '<span class="drag-handle po-drag-handle" data-po-drag-handle="true"></span>' +
      thumb +
      '<div class="presson-card-info"><h4>' + c.name + '</h4><p>' + (c.description || 'No description') + '</p></div>' +
      '<div class="presson-card-price">' + (c.price || '-') + '</div>' +
      '<div class="btn-group"><button class="btn btn-secondary btn-sm btn-po-edit" data-id="' + c.id + '">Edit</button><button class="btn btn-danger btn-sm btn-po-delete" data-id="' + c.id + '">Delete</button></div>' +
      '</div>';
  }
  list.innerHTML = html;

  var poDraggedIdx = -1;

  list.querySelectorAll(".presson-card-item").forEach(function(card) {
    card.addEventListener("click", function(e) {
      if (e.target.closest(".btn, .po-drag-handle")) return;
    });

    card.addEventListener("dragstart", function(e) {
      if (e.target.closest(".btn")) { e.preventDefault(); return; }
      poDraggedIdx = parseInt(card.dataset.idx);
      desktopDragging = true;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(poDraggedIdx));
    });

    card.addEventListener("dragend", function() {
      card.classList.remove("dragging");
      list.querySelectorAll(".presson-card-item").forEach(function(c) { c.classList.remove("drag-over"); });
      poDraggedIdx = -1;
      desktopDragging = false;
      stopAutoScroll();
    });

    card.addEventListener("dragover", function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      var targetIdx = parseInt(card.dataset.idx);
      if (targetIdx !== poDraggedIdx) card.classList.add("drag-over");
    });

    card.addEventListener("dragleave", function() { card.classList.remove("drag-over"); });

    card.addEventListener("drop", function(e) {
      e.preventDefault();
      card.classList.remove("drag-over");
      stopAutoScroll();
      desktopDragging = false;
      var targetIdx = parseInt(card.dataset.idx);
      if (targetIdx === poDraggedIdx || poDraggedIdx === -1) return;
      var dragged = pressOnCards[poDraggedIdx];
      pressOnCards.splice(poDraggedIdx, 1);
      pressOnCards.splice(targetIdx, 0, dragged);
      poDragOrderChanged = true;
      updatePoSaveOrderButton();
      renderPressOnList();
    });
  });

  list.querySelectorAll(".btn-po-edit").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var card = null;
      for (var k = 0; k < pressOnCards.length; k++) { if (pressOnCards[k].id === btn.dataset.id) { card = pressOnCards[k]; break; } }
      if (!card) return;
      document.getElementById("po-edit-id").value = card.id;
      document.getElementById("po-name").value = card.name;
      document.getElementById("po-price").value = card.price || "";
      document.getElementById("po-description").value = card.description || "";
      document.getElementById("po-imageId").value = card.imageId || "";
      document.querySelectorAll(".image-picker-item").forEach(function(x) { x.classList.remove("selected"); });
      if (card.imageId) {
        var pickerImg = document.querySelector('.image-picker-item[data-id="' + card.imageId + '"]');
        if (pickerImg) pickerImg.classList.add("selected");
      }
      document.getElementById("po-form-header").textContent = "Edit Card";
      document.getElementById("po-submit-btn").textContent = "Save Changes";
      document.getElementById("btn-cancel-edit").style.display = "inline-flex";
    });
  });
  list.querySelectorAll(".btn-po-delete").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      if (!confirm("Delete this card?")) return;
      try {
        await fetch("/api/press-on/" + btn.dataset.id, { method: "DELETE", headers: { "X-CSRF-Token": CSRF } });
        pressOnCards = pressOnCards.filter(function(c) { return c.id !== btn.dataset.id; });
        renderPressOnList(); toast("Card deleted", "info");
      } catch (err) { toast("Failed to delete", "error"); }
    });
  });
  updatePoSaveOrderButton();
}

var pressOnForm = document.getElementById("presson-create-form");
if (pressOnForm) pressOnForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  var editId = document.getElementById("po-edit-id").value;
  var name = document.getElementById("po-name").value.trim();
  var price = document.getElementById("po-price").value.trim();
  var description = document.getElementById("po-description").value.trim();
  var imageId = document.getElementById("po-imageId").value;
  if (!name) { toast("Name is required", "error"); return; }
  try {
    var method = editId ? "PATCH" : "POST";
    var url = editId ? "/api/press-on/" + editId : "/api/press-on";
    var res = await fetch(url, {
      method: method, headers: { "Content-Type": "application/json", "X-CSRF-Token": CSRF },
      body: JSON.stringify({ name: name, price: price, description: description, imageId: imageId }),
    });
    if (!res.ok) throw new Error(((await res.json()).error) || "Failed");
    var data = await res.json();
    if (editId) {
      for (var i = 0; i < pressOnCards.length; i++) {
        if (pressOnCards[i].id === editId) { pressOnCards[i] = data.item; break; }
      }
      toast("Card updated", "success");
    } else {
      pressOnCards.push(data.item);
      toast("Card created", "success");
    }
    renderPressOnList();
    resetPressOnForm();
  } catch (err) { toast(err.message, "error"); }
});

var btnCancelEdit = document.getElementById("btn-cancel-edit");
if (btnCancelEdit) btnCancelEdit.addEventListener("click", resetPressOnForm);

function resetPressOnForm() {
  document.getElementById("po-edit-id").value = "";
  document.getElementById("po-name").value = "";
  document.getElementById("po-price").value = "";
  document.getElementById("po-description").value = "";
  document.getElementById("po-imageId").value = "";
  document.querySelectorAll(".image-picker-item").forEach(function(x) { x.classList.remove("selected"); });
  document.getElementById("po-form-header").textContent = "Create New Card";
  document.getElementById("po-submit-btn").textContent = "Add Card";
  document.getElementById("btn-cancel-edit").style.display = "none";
}

var poTouchDrag = { timer: null, idx: -1, clone: null, sx: 0, sy: 0, moved: false, active: false };

function initPoTouchDrag() {
  var list = document.getElementById("presson-list");
  if (!isTouchDevice || !list) return;

  list.addEventListener("touchstart", function(e) {
    var card = e.target.closest(".presson-card-item");
    if (!card || e.target.closest(".btn, .btn-po-edit, .btn-po-delete")) return;
    var t = e.touches[0];
    poTouchDrag.idx = parseInt(card.dataset.idx);
    poTouchDrag.sx = t.clientX;
    poTouchDrag.sy = t.clientY;
    poTouchDrag.moved = false;
    poTouchDrag.active = false;
    clearTimeout(poTouchDrag.timer);
    poTouchDrag.timer = setTimeout(function() {
      poTouchDrag.active = true;
      card.classList.add("touch-dragging");
      var rect = card.getBoundingClientRect();
      var cloneEl = card.cloneNode(true);
      cloneEl.classList.add("touch-drag-clone");
      cloneEl.style.position = "fixed";
      cloneEl.style.left = rect.left + "px";
      cloneEl.style.top = rect.top + "px";
      cloneEl.style.width = rect.width + "px";
      cloneEl.style.zIndex = "9999";
      cloneEl.style.pointerEvents = "none";
      cloneEl.style.transition = "none";
      document.body.appendChild(cloneEl);
      poTouchDrag.clone = cloneEl;
    }, 400);
  }, { passive: true });

  list.addEventListener("touchmove", function(e) {
    if (!poTouchDrag.active || !poTouchDrag.clone) return;
    e.preventDefault();
    var t = e.touches[0];
    poTouchDrag.moved = true;
    handleAutoScroll(t.clientY);
    var w = poTouchDrag.clone.offsetWidth;
    poTouchDrag.clone.style.left = (t.clientX - w / 2) + "px";
    poTouchDrag.clone.style.top = (t.clientY - 50) + "px";

    list.querySelectorAll(".presson-card-item").forEach(function(c) { c.classList.remove("touch-drag-over"); });
    poTouchDrag.clone.style.display = "none";
    var el = document.elementFromPoint(t.clientX, t.clientY);
    poTouchDrag.clone.style.display = "";
    var targetCard = el ? el.closest(".presson-card-item") : null;
    if (targetCard && parseInt(targetCard.dataset.idx) !== poTouchDrag.idx) {
      targetCard.classList.add("touch-drag-over");
    }
  }, { passive: false });

  list.addEventListener("touchend", function(e) {
    clearTimeout(poTouchDrag.timer);
    stopAutoScroll();
    if (poTouchDrag.clone) { poTouchDrag.clone.remove(); poTouchDrag.clone = null; }

    list.querySelectorAll(".presson-card-item").forEach(function(c) { c.classList.remove("touch-dragging", "touch-drag-over"); });

    if (!poTouchDrag.active || !poTouchDrag.moved) { poTouchDrag.idx = -1; poTouchDrag.active = false; return; }

    var t = e.changedTouches[0];
    var el = document.elementFromPoint(t.clientX, t.clientY);
    var targetCard = el ? el.closest(".presson-card-item") : null;
    var targetIdx = targetCard ? parseInt(targetCard.dataset.idx) : -1;

    if (targetIdx >= 0 && targetIdx !== poTouchDrag.idx) {
      var item = pressOnCards.splice(poTouchDrag.idx, 1)[0];
      pressOnCards.splice(targetIdx, 0, item);
      poDragOrderChanged = true;
      updatePoSaveOrderButton();
      renderPressOnList();
    }

    poTouchDrag.idx = -1;
    poTouchDrag.active = false;
    poTouchDrag.moved = false;
  });

  list.addEventListener("touchcancel", function() {
    clearTimeout(poTouchDrag.timer);
    stopAutoScroll();
    if (poTouchDrag.clone) { poTouchDrag.clone.remove(); poTouchDrag.clone = null; }
    list.querySelectorAll(".presson-card-item").forEach(function(c) { c.classList.remove("touch-dragging", "touch-drag-over"); });
    poTouchDrag.idx = -1;
    poTouchDrag.active = false;
    poTouchDrag.moved = false;
  });
}

initPoTouchDrag();