const CSRF = document.cookie.split("; ").find(r => r.startsWith("__nail_csrf="))?.split("=")[1] ?? "";

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
var imageGrid = document.getElementById("image-grid");
var batchActions = document.getElementById("batch-actions");
var batchCount = document.getElementById("batch-count");

function toggleImageSelection(img, card) { img.selected = !img.selected; card.classList.toggle("selected", img.selected); updateBatchUI(); }

function updateBatchUI() {
  var selected = allImages.filter(function(i) { return i.selected; });
  if (batchActions) batchActions.classList.toggle("visible", selected.length > 0);
  if (batchCount) batchCount.textContent = selected.length + " selected";
}

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
    html += '<div class="image-card ' + (img.selected ? 'selected' : '') + '" data-idx="' + idx + '">' +
      '<img class="image-card-thumb" src="' + img.url + '" alt="' + img.alt + '" loading="lazy" />' +
      '<div class="image-card-body">' +
      '<div class="image-card-name" title="' + img.filename + '">' + img.filename + '</div>' +
      '<div class="image-card-sections">' + barns + '</div>' +
      '<div class="image-card-actions"><button class="btn btn-secondary btn-sm btn-delete" data-idx="' + idx + '">Delete</button></div>' +
      '<div class="image-card-alt" data-idx="' + idx + '" title="Click to edit alt text">' + (img.alt || 'Click to edit alt') + '</div>' +
      '</div></div>';
  }
  imageGrid.innerHTML = html;

  imageGrid.querySelectorAll(".image-card").forEach(function(card) {
    card.addEventListener("click", function(e) {
      if (e.target.closest(".section-badge, .btn, .image-card-alt")) return;
      var idx = parseInt(card.dataset.idx);
      toggleImageSelection(allImages[idx], card);
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
}

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
    html += '<div class="presson-card-item">' +
      thumb +
      '<div class="presson-card-info"><h4>' + c.name + '</h4><p>' + (c.description || 'No description') + '</p></div>' +
      '<div class="presson-card-price">' + (c.price || '-') + '</div>' +
      '<div class="btn-group"><button class="btn btn-secondary btn-sm btn-po-edit" data-id="' + c.id + '">Edit</button><button class="btn btn-danger btn-sm btn-po-delete" data-id="' + c.id + '">Delete</button></div>' +
      '</div>';
  }
  list.innerHTML = html;
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