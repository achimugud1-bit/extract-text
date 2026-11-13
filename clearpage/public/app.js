const $ = (id) => document.getElementById(id);
let pages = [],
  selected = null,
  busy = false,
  installPrompt = null,
  loadingFiles = false;
const fileInput = $("fileInput");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function toast(msg) {
  $("toast").textContent = msg;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 4500);
}
function modal(id) {
  $(id).showModal();
}
document
  .querySelectorAll("[data-close]")
  .forEach((b) => (b.onclick = () => $(b.dataset.close).close()));
["settingsBtn", "settingsTop", "mobileSettings"].forEach(
  (id) => ($(id).onclick = () => modal("settingsDialog")),
);
$("assistantNav").onclick = () => modal("assistantDialog");
$("workspaceNav").onclick = () =>
  window.scrollTo({ top: 0, behavior: "smooth" });
$("groqKey").oninput = () => {
  $("keyDot").classList.toggle("ready", !!$("groqKey").value.trim());
};
["browseBtn", "addMore", "addPage"].forEach(
  (id) =>
    ($(id).onclick = () => {
      if (!busy && !loadingFiles) fileInput.click();
    }),
);
fileInput.onchange = async () => {
  await addFiles([...fileInput.files]);
  fileInput.value = "";
};
let drop = $("dropArea");
["dragenter", "dragover"].forEach((x) =>
  drop.addEventListener(x, (e) => {
    e.preventDefault();
    drop.classList.add("drag");
  }),
);
["dragleave", "drop"].forEach((x) =>
  drop.addEventListener(x, (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
  }),
);
drop.addEventListener("drop", (e) => addFiles([...e.dataTransfer.files]));
function readFile(file) {
  return new Promise((resolve, reject) => {
    let r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Could not read " + file.name));
    r.readAsDataURL(file);
  });
}
async function addFiles(files) {
  if (busy || loadingFiles) return;
  if (!files.length) return;
  loadingFiles = true;
  let errors = [],
    added = 0;
  for (const file of files) {
    if (pages.length >= 50) {
      errors.push("50-image limit reached");
      break;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      errors.push(file.name + ": unsupported format");
      continue;
    }
    if (file.size > 15 * 1024 * 1024) {
      errors.push(file.name + ": over 15 MB");
      continue;
    }
    try {
      let data = await readFile(file);
      let p = {
        id: crypto.randomUUID(),
        name: file.name,
        image: data,
        text: "",
        status: "ready",
        message: "",
      };
      pages.push(p);
      if (!selected) selected = p.id;
      added++;
    } catch (e) {
      errors.push(e.message);
    }
  }
  loadingFiles = false;
  render();
  if (errors.length)
    toast(
      errors[0] + (errors.length > 1 ? ` (and ${errors.length - 1} more)` : ""),
    );
  else if (added) toast(`${added} image${added === 1 ? "" : "s"} added`);
}
function current() {
  return pages.find((p) => p.id === selected);
}
function label(p) {
  return {
    ready: "Ready to extract",
    processing: "Extracting…",
    verifying: "Checking image…",
    done: "Extracted",
    error: "Needs attention",
  }[p.status];
}
function render() {
  let p = current(),
    has = pages.length > 0;
  $("countBadge").textContent = `${pages.length} / 50`;
  $("pageCount").textContent =
    `${pages.length} image${pages.length === 1 ? "" : "s"}`;
  $("emptyState").hidden = has;
  $("workspace").hidden = !has;
  $("extractAll").disabled = busy || !has;
  $("addMore").disabled = busy || pages.length >= 50;
  $("addPage").disabled = busy || pages.length >= 50;
  $("clearAll").disabled = busy;
  $("verifyToggle").disabled = busy;
  $("pageList").innerHTML = pages
    .map(
      (x, i) =>
        `<div class="page ${x.id === selected ? "selected" : ""}" data-id="${x.id}" role="button" tabindex="0"><img src="${x.image}" alt=""><div class="page-info"><div class="page-name">${String(i + 1).padStart(2, "0")} &nbsp; ${esc(x.name)}</div><div class="page-state ${x.status}">${esc(label(x))}</div></div><div class="page-controls"><button data-action="up" title="Move up" ${busy || i === 0 ? "disabled" : ""}>▲</button><button data-action="down" title="Move down" ${busy || i === pages.length - 1 ? "disabled" : ""}>▼</button><button data-action="remove" title="Remove page" ${busy ? "disabled" : ""}>×</button></div></div>`,
    )
    .join("");
  if (!p) return;
  let idx = pages.indexOf(p);
  $("selectedTitle").textContent =
    `Page ${String(idx + 1).padStart(2, "0")} · ${p.name}`;
  $("selectedStatus").textContent = label(p);
  $("selectedStatus").className = "status " + p.status;
  $("previewImage").src = p.image;
  $("outputText").value = p.text;
  $("outputText").disabled = busy;
  $("extractPage").disabled = busy;
  $("extractPage").textContent = p.text
    ? "↻  Re-extract this page"
    : "✧  Extract this page";
  $("pageMessage").textContent =
    p.message || "Review each page against the original for accuracy.";
  wordCount();
  let done = pages.filter((x) => x.status === "done").length,
    err = pages.filter((x) => x.status === "error").length;
  $("progressTitle").textContent = busy
    ? "Working through your pages…"
    : `${done} of ${pages.length} pages extracted`;
  $("progressText").textContent = err
    ? `${err} page${err === 1 ? " needs" : "s need"} attention. Select to retry.`
    : "Your pages will be processed in order.";
}
$("pageList").onclick = (e) => {
  let row = e.target.closest(".page");
  if (!row) return;
  let id = row.dataset.id,
    idx = pages.findIndex((p) => p.id === id),
    action = e.target.dataset.action;
  if (action) {
    if (busy) return;
    if (action === "up" && idx > 0)
      [pages[idx - 1], pages[idx]] = [pages[idx], pages[idx - 1]];
    if (action === "down" && idx < pages.length - 1)
      [pages[idx + 1], pages[idx]] = [pages[idx], pages[idx + 1]];
    if (action === "remove") {
      if (
        pages[idx].text &&
        !confirm("Remove this page and its extracted text?")
      )
        return;
      pages.splice(idx, 1);
      if (selected === id)
        selected = pages[Math.min(idx, pages.length - 1)]?.id || null;
    }
  } else selected = id;
  render();
};
$("pageList").onkeydown = (e) => {
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.classList.contains("page")
  ) {
    e.preventDefault();
    selected = e.target.dataset.id;
    render();
  }
};
function wordCount() {
  let t = $("outputText").value.trim();
  $("wordCount").textContent = (t ? t.split(/\s+/).length : 0) + " words";
}
$("outputText").oninput = () => {
  let p = current();
  if (p) {
    p.text = $("outputText").value;
    wordCount();
  }
};
$("clearAll").onclick = () => {
  if (
    !busy &&
    confirm("Clear all images and extracted text? This cannot be undone.")
  ) {
    pages = [];
    selected = null;
    render();
  }
};
async function api(url, data) {
  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  let json = await res.json();
  if (!res.ok) throw new Error(json.error || "Something went wrong.");
  return json;
}
async function run(targets) {
  if (busy) return;
  let key = $("groqKey").value.trim();
  if (!key) {
    toast("Add your Groq API key to begin.");
    modal("settingsDialog");
    return;
  }
  if (!targets.length) {
    toast(
      "All pages have already been extracted. Select a page to re-extract it.",
    );
    return;
  }
  busy = true;
  render();
  for (const p of targets) {
    p.status = "processing";
    p.message = "Sending this image to Qwen vision through Groq…";
    render();
    try {
      let params = { key, image: p.image, model: $("groqModel").value.trim() },
        result = await api("/api/ocr", params);
      p.text = result.text;
      p.message =
        result.finish_reason === "length"
          ? "The response may be incomplete (output limit reached). Check the original image."
          : "";
      if ($("verifyToggle").checked) {
        p.status = "verifying";
        render();
        try {
          let checked = await api("/api/ocr", {
            ...params,
            verify: true,
            draft: p.text,
          });
          p.text = checked.text;
          if (checked.finish_reason === "length")
            p.message =
              "The checked response may be incomplete (output limit reached). Check the original image.";
        } catch (e) {
          p.message =
            "First pass saved, but the second check failed: " + e.message;
        }
      }
      p.status = "done";
      if (!p.message)
        p.message =
          "Extraction complete. Compare with the original before exporting.";
    } catch (e) {
      p.status = "error";
      p.message = e.message;
    }
    render();
  }
  busy = false;
  render();
  toast("Processing finished. Please review your pages.");
}
$("extractAll").onclick = () =>
  run(pages.filter((p) => p.status === "ready" || p.status === "error"));
$("extractPage").onclick = () => {
  let p = current();
  if (!p) return;
  if (
    p.text &&
    !confirm(
      "Re-extract this page? Its current text, including your edits, will be replaced if extraction succeeds.",
    )
  )
    return;
  run([p]);
};
function documentText() {
  return pages
    .filter((p) => p.text.trim())
    .map((p) => `--- Page ${pages.indexOf(p) + 1}: ${p.name} ---\n\n${p.text}`)
    .join("\n\n");
}
async function copy(t) {
  if (!t.trim()) {
    toast("There is no text to copy yet.");
    return;
  }
  try {
    await navigator.clipboard.writeText(t);
    toast("Copied to clipboard.");
  } catch {
    toast("Clipboard access was blocked. Select and copy the text manually.");
  }
}
$("copyPage").onclick = () => copy(current()?.text || "");
$("copyAll").onclick = () => copy(documentText());
$("downloadAll").onclick = () => {
  let t = documentText();
  if (!t) {
    toast("Extract or add text before downloading.");
    return;
  }
  let a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([t], { type: "text/plain;charset=utf-8" }),
  );
  a.download = "clearpage-transcription.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$("askAssistant").onclick = async () => {
  let key = $("openaiKey").value.trim(),
    q = $("question").value.trim(),
    context =
      $("assistantScope").value === "page"
        ? current()?.text || ""
        : documentText();
  if (!key) {
    toast("Add an OpenAI API key in settings first.");
    $("assistantDialog").close();
    modal("settingsDialog");
    return;
  }
  if (!context.trim()) return toast("Extract some text first.");
  if (!q) return toast("Enter a question or request.");
  if (context.length > 150000)
    return toast(
      "The selected text is too long. Use the selected-page option instead.",
    );
  $("askAssistant").disabled = true;
  $("askAssistant").textContent = "Thinking…";
  try {
    let r = await api("/api/assist", {
      key,
      question: q,
      context,
      model: $("openaiModel").value.trim(),
    });
    $("answer").textContent =
      r.text +
      (r.finish_reason === "length" ? "\n\n[Response may be incomplete.]" : "");
    $("assistantResult").hidden = false;
  } catch (e) {
    toast(e.message);
  } finally {
    $("askAssistant").disabled = false;
    $("askAssistant").textContent = "✧  Ask assistant";
  }
};
$("copyAnswer").onclick = () => copy($("answer").textContent);
window.addEventListener("beforeunload", (e) => {
  if (pages.length) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  $("installBtn").hidden = false;
});
$("installBtn").onclick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("installBtn").hidden = true;
};
window.addEventListener("appinstalled", () => {
  $("installBtn").hidden = true;
  toast("Clearpage installed.");
});
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
render();
