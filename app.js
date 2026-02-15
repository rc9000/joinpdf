const els = {
  pdfs: document.getElementById("pdfs"),
  fileList: document.getElementById("fileList"),
  insertDivider: document.getElementById("insertDivider"),
  addCover: document.getElementById("addCover"),
  outputName: document.getElementById("outputName"),
  mergeBtn: document.getElementById("mergeBtn"),
  status: document.getElementById("status"),
  downloadLink: document.getElementById("downloadLink"),
  languageSelect: document.getElementById("languageSelect"),
};

const MAX_FILES = 10;

const O_RDONLY = 0;
const O_WRONLY = 1;
const O_RDWR = 2;
const O_CREAT = 64;
const O_EXCL = 128;
const O_TRUNC = 512;
const O_APPEND = 1024;

let mergedUrl = null;
let wasmBytesPromise = null;
let lastStatusKey = null;

const I18N = {
  en: {
    languageEnglish: "English",
    languageBern: "Bärndütsch",
    labelLanguage: "Language",
    labelPdfs: "PDF files (2 to 10, in order)",
    labelInsertDivider: "Insert a blank page between merged documents",
    labelAddCover: "Add a cover page listing included documents",
    labelOutputName: "Output filename",
    buttonMerge: "Merge PDFs",
    statusTitle: "Status",
    downloadLink: "Download merged PDF",
    subtitle: "Fast browser-only PDF merges powered by <code>pdfcpu.wasm</code>",
    infoTitle: "How This Works",
    infoText1: "JoinPDF runs fully in your browser. Your PDF files are processed locally in memory using WebAssembly, and they are not uploaded or sent to any server.",
    infoText2: "Powered by <a href=\"https://github.com/pdfcpu/pdfcpu\" target=\"_blank\" rel=\"noopener noreferrer\">pdfcpu</a> compiled to <a href=\"https://en.wikipedia.org/wiki/WebAssembly\" target=\"_blank\" rel=\"noopener noreferrer\">WebAssembly</a> made by christian-at-ramseyer.it. Check out the <a href=\"https://github.com/rc9000/joinpdf\" target=\"_blank\" rel=\"noopener noreferrer\">github repo</a> to contribute or download the files to self-host.",
    defaultOutputName: "merged.pdf",
    statusReady: "Ready.",
    statusTooMany: "You selected {count} files. Only the first {max} will be merged.",
    statusSelectAtLeast: "Select at least 2 PDF files.",
    statusInvalidFile: "Invalid file: {name}. Only PDF files are allowed.",
    statusMerging: "Merging...",
    statusMergeComplete: "Merge complete.",
    statusErrorPrefix: "Error",
    statusPass1: "Running pass 1/2: merge documents with divider pages...",
    statusPass2: "Running pass 2/2: prepend cover page...",
    coverTitle: "JoinPDF",
    coverSubtitle: "ramseyer.it/joinpdf",
    coverHeading: "Joined PDF documents in this file:",
  },
  gsw: {
    languageEnglish: "English",
    languageBern: "Bärndütsch",
    labelLanguage: "Sprach",
    labelPdfs: "PDFs zum zämechläbe (zwöi bis zäh, genau i dere Reihefoug)",
    labelInsertDivider: "Lääri Site zwüsche d'Dokumänt",
    labelAddCover: "Deckblatt mit Liste vo aune PDFs",
    labelOutputName: "Dateiname",
    buttonMerge: "Ab der Bäse",
    statusTitle: "Schtatus",
    downloadLink: "Zämegchläbts PDF abelade",
    subtitle: "Schnäus Browser-only PDF-Zämechläbe, gmacht mit <code>pdfcpu.wasm</code>",
    infoTitle: "Wie das lauft",
    infoText1: "JoinPDF louft vou im Browser. Dini PDFs bliibed lokal im Speicher und gö niene häre. Kei Cloud, kei Abzockerei, kei Ficheskandau.",
    infoText2: "Gmacht mit <a href=\"https://github.com/pdfcpu/pdfcpu\" target=\"_blank\" rel=\"noopener noreferrer\">pdfcpu</a>, mit Wäutruum-Technolgoie <a href=\"https://en.wikipedia.org/wiki/WebAssembly\" target=\"_blank\" rel=\"noopener noreferrer\">WebAssembly</a>, gmacht vom christian-at-ramseyer.it. S'GitHub isch do: <a href=\"https://github.com/rc9000/joinpdf\" target=\"_blank\" rel=\"noopener noreferrer\">repo</a> zum Mitmache oder selber hoste.",
    defaultOutputName: "fertig.pdf",
    statusReady: "Bereit.",
    statusTooMany: "Du hesch {count} Datei ufeglade. Numme di erschte {max} wärded zämegchläbt",
    statusSelectAtLeast: "Brucht mindeschtens zwöi PDF-Dateie.",
    statusInvalidFile: "Das da isch keis PDF: {name}. Nume PDFs bitte.",
    statusMerging: "Am zämechläbe...",
    statusMergeComplete: "Fertig zämegchläbt.",
    statusErrorPrefix: "Hoppla",
    statusPass1: "Schrittli 1/2: Dokumänt mit lääre Sitä...",
    statusPass2: "Schrittli 2/2: Deckblatt vorne dra...",
    coverTitle: "JoinPDF",
    coverSubtitle: "ramseyer.it/joinpdf",
    coverHeading: "Joined PDF documents in this file:",
  },
};

function t(key, vars = {}) {
  const table = I18N[currentLang] || I18N.en;
  const raw = table[key] ?? I18N.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

let currentLang = "en";

function applyTranslations(lang) {
  currentLang = I18N[lang] ? lang : "en";
  document.documentElement.lang = currentLang === "gsw" ? "de-CH" : "en";

  const textNodes = document.querySelectorAll("[data-i18n]");
  textNodes.forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  const htmlNodes = document.querySelectorAll("[data-i18n-html]");
  htmlNodes.forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });

  const placeholderNodes = document.querySelectorAll("[data-i18n-placeholder]");
  placeholderNodes.forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  if (els.languageSelect) {
    const options = els.languageSelect.options;
    if (options[0]) options[0].textContent = t("languageEnglish");
    if (options[1]) options[1].textContent = t("languageBern");
    els.languageSelect.value = currentLang;
  }

  if (!els.outputName.dataset.edited) {
    els.outputName.value = t("defaultOutputName");
  }

  if (lastStatusKey) {
    setStatus(t(lastStatusKey.key, lastStatusKey.vars));
  }
}

function setStatus(text) {
  els.status.textContent = text;
}

function appendStatus(line) {
  lastStatusKey = null;
  els.status.textContent = `${els.status.textContent}\n${line}`.trim();
}

function setStatusMessage(key, vars) {
  lastStatusKey = { key, vars };
  setStatus(t(key, vars));
}

function disableDownload() {
  if (mergedUrl) {
    URL.revokeObjectURL(mergedUrl);
    mergedUrl = null;
  }
  els.downloadLink.href = "#";
  els.downloadLink.classList.add("disabled");
  els.downloadLink.setAttribute("aria-disabled", "true");
}

function enableDownload(blob, filename) {
  if (mergedUrl) {
    URL.revokeObjectURL(mergedUrl);
  }
  mergedUrl = URL.createObjectURL(blob);
  els.downloadLink.href = mergedUrl;
  els.downloadLink.download = filename;
  els.downloadLink.classList.remove("disabled");
  els.downloadLink.setAttribute("aria-disabled", "false");
}

function toErr(code, msg = code) {
  const err = new Error(msg);
  err.code = code;
  return err;
}

function createStats(entry) {
  const size = entry.type === "file" ? entry.data.length : 0;
  const mode = entry.type === "dir" ? 0o040755 : 0o100644;
  return {
    dev: 1,
    ino: 1,
    mode,
    nlink: 1,
    uid: 0,
    gid: 0,
    rdev: 0,
    size,
    blksize: 4096,
    blocks: Math.ceil(size / 4096),
    atimeMs: entry.atime,
    mtimeMs: entry.mtime,
    ctimeMs: entry.ctime,
    birthtimeMs: entry.ctime,
    isDirectory: () => entry.type === "dir",
    isFile: () => entry.type === "file",
    isSymbolicLink: () => false,
  };
}

function normalizePath(path, cwd) {
  const joined = path.startsWith("/") ? path : `${cwd}/${path}`;
  const parts = [];
  for (const part of joined.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return `/${parts.join("/")}`;
}

function createMemFS(logLine) {
  const entries = new Map();
  const fds = new Map();
  let nextFd = 20;
  let cwd = "/";

  const now = () => Date.now();
  const mkDir = () => ({ type: "dir", children: new Set(), ctime: now(), mtime: now(), atime: now() });
  const mkFile = (bytes = new Uint8Array()) => ({ type: "file", data: bytes, ctime: now(), mtime: now(), atime: now() });

  function ensureParent(path) {
    const idx = path.lastIndexOf("/");
    const parent = idx <= 0 ? "/" : path.slice(0, idx);
    const parentEntry = entries.get(parent);
    if (!parentEntry || parentEntry.type !== "dir") {
      throw toErr("ENOENT", `missing parent: ${parent}`);
    }
    return parent;
  }

  function makeDir(path) {
    if (entries.has(path)) {
      const existing = entries.get(path);
      if (existing.type !== "dir") {
        throw toErr("ENOTDIR");
      }
      return;
    }
    const parent = ensureParent(path);
    entries.set(path, mkDir());
    entries.get(parent).children.add(path.split("/").pop());
  }

  function writeFile(path, bytes) {
    const parent = ensureParent(path);
    entries.set(path, mkFile(bytes));
    entries.get(parent).children.add(path.split("/").pop());
  }

  function readFile(path) {
    const entry = entries.get(path);
    if (!entry || entry.type !== "file") {
      throw toErr("ENOENT", `file not found: ${path}`);
    }
    return entry.data;
  }

  function getEntryFromPath(path) {
    const abs = normalizePath(path, cwd);
    const entry = entries.get(abs);
    if (!entry) {
      throw toErr("ENOENT", abs);
    }
    return { entry };
  }

  entries.set("/", mkDir());
  makeDir("/tmp");
  makeDir("/work");

  function open(path, flags, mode, cb) {
    if (typeof mode === "function") {
      cb = mode;
      mode = 0o666;
    }
    try {
      const abs = normalizePath(path, cwd);
      let entry = entries.get(abs);
      const wantsWrite = (flags & O_WRONLY) !== 0 || (flags & O_RDWR) !== 0;
      const create = (flags & O_CREAT) !== 0;
      const excl = (flags & O_EXCL) !== 0;
      const trunc = (flags & O_TRUNC) !== 0;

      if (!entry) {
        if (!create) {
          cb(toErr("ENOENT", abs));
          return;
        }
        writeFile(abs, new Uint8Array());
        entry = entries.get(abs);
      } else if (entry.type === "dir") {
        cb(toErr("EISDIR", abs));
        return;
      } else if (create && excl) {
        cb(toErr("EEXIST", abs));
        return;
      }

      if (trunc && wantsWrite) {
        entry.data = new Uint8Array();
        entry.mtime = now();
      }

      const fd = nextFd++;
      fds.set(fd, {
        path: abs,
        position: (flags & O_APPEND) ? entry.data.length : 0,
      });
      cb(null, fd);
    } catch (err) {
      cb(err);
    }
  }

  const fs = {
    constants: {
      O_RDONLY,
      O_WRONLY,
      O_RDWR,
      O_CREAT,
      O_TRUNC,
      O_APPEND,
      O_EXCL,
      O_DIRECTORY: 65536,
    },

    getCwd() {
      return cwd;
    },

    setCwd(path) {
      const abs = normalizePath(path, cwd);
      const entry = entries.get(abs);
      if (!entry || entry.type !== "dir") {
        throw toErr("ENOENT", `cwd not found: ${abs}`);
      }
      cwd = abs;
    },

    writeFile(path, bytes) {
      writeFile(normalizePath(path, cwd), bytes);
    },

    readFile(path) {
      return readFile(normalizePath(path, cwd));
    },

    writeSync(fd, buf) {
      if (fd === 1 || fd === 2) {
        const text = new TextDecoder().decode(buf);
        text.split(/\r?\n/).forEach((line) => {
          if (line.trim()) {
            logLine(line);
          }
        });
      }
      return buf.length;
    },

    open,

    close(fd, cb) {
      if (!fds.has(fd)) {
        cb(toErr("EBADF"));
        return;
      }
      fds.delete(fd);
      cb(null);
    },

    read(fd, buffer, offset, length, position, cb) {
      const handle = fds.get(fd);
      if (!handle) {
        cb(toErr("EBADF"));
        return;
      }
      const entry = entries.get(handle.path);
      if (!entry || entry.type !== "file") {
        cb(toErr("ENOENT"));
        return;
      }
      const pos = position == null ? handle.position : position;
      const available = Math.max(0, entry.data.length - pos);
      const toRead = Math.min(length, available);
      if (toRead > 0) {
        buffer.set(entry.data.subarray(pos, pos + toRead), offset);
      }
      if (position == null) {
        handle.position += toRead;
      }
      entry.atime = now();
      cb(null, toRead);
    },

    write(fd, buffer, offset, length, position, cb) {
      if (fd === 1 || fd === 2) {
        const n = this.writeSync(fd, buffer.subarray(offset, offset + length));
        cb(null, n);
        return;
      }
      const handle = fds.get(fd);
      if (!handle) {
        cb(toErr("EBADF"));
        return;
      }
      const entry = entries.get(handle.path);
      if (!entry || entry.type !== "file") {
        cb(toErr("ENOENT"));
        return;
      }
      const pos = position == null ? handle.position : position;
      const end = pos + length;
      if (end > entry.data.length) {
        const grown = new Uint8Array(end);
        grown.set(entry.data);
        entry.data = grown;
      }
      entry.data.set(buffer.subarray(offset, offset + length), pos);
      if (position == null) {
        handle.position = end;
      }
      entry.mtime = now();
      cb(null, length);
    },

    stat(path, cb) {
      try {
        const { entry } = getEntryFromPath(path);
        cb(null, createStats(entry));
      } catch (err) {
        cb(err);
      }
    },

    lstat(path, cb) {
      this.stat(path, cb);
    },

    fstat(fd, cb) {
      if (fd === 1 || fd === 2) {
        cb(null, createStats(mkFile()));
        return;
      }
      const handle = fds.get(fd);
      if (!handle) {
        cb(toErr("EBADF"));
        return;
      }
      const entry = entries.get(handle.path);
      if (!entry) {
        cb(toErr("ENOENT"));
        return;
      }
      cb(null, createStats(entry));
    },

    readdir(path, cb) {
      try {
        const { entry } = getEntryFromPath(path);
        if (entry.type !== "dir") {
          cb(toErr("ENOTDIR"));
          return;
        }
        cb(null, Array.from(entry.children));
      } catch (err) {
        cb(err);
      }
    },

    mkdir(path, perm, cb) {
      try {
        makeDir(normalizePath(path, cwd));
        cb(null);
      } catch (err) {
        cb(err);
      }
    },

    rename(from, to, cb) {
      try {
        const absFrom = normalizePath(from, cwd);
        const absTo = normalizePath(to, cwd);
        const entry = entries.get(absFrom);
        if (!entry) {
          cb(toErr("ENOENT"));
          return;
        }
        ensureParent(absTo);
        entries.set(absTo, entry);
        entries.delete(absFrom);
        cb(null);
      } catch (err) {
        cb(err);
      }
    },

    unlink(path, cb) {
      try {
        const abs = normalizePath(path, cwd);
        const entry = entries.get(abs);
        if (!entry || entry.type !== "file") {
          cb(toErr("ENOENT"));
          return;
        }
        entries.delete(abs);
        cb(null);
      } catch (err) {
        cb(err);
      }
    },

    rmdir(path, cb) {
      try {
        const abs = normalizePath(path, cwd);
        const entry = entries.get(abs);
        if (!entry || entry.type !== "dir") {
          cb(toErr("ENOENT"));
          return;
        }
        if (entry.children.size > 0) {
          cb(toErr("ENOTEMPTY"));
          return;
        }
        entries.delete(abs);
        cb(null);
      } catch (err) {
        cb(err);
      }
    },

    chmod(path, mode, cb) { cb(null); },
    chown(path, uid, gid, cb) { cb(null); },
    fchmod(fd, mode, cb) { cb(null); },
    fchown(fd, uid, gid, cb) { cb(null); },
    truncate(path, len, cb) { cb(null); },
    ftruncate(fd, len, cb) { cb(null); },
    utimes(path, atime, mtime, cb) { cb(null); },
    fsync(fd, cb) { cb(null); },
    readlink(path, cb) { cb(toErr("ENOSYS")); },
    symlink(path, link, cb) { cb(toErr("ENOSYS")); },
    link(path, link, cb) { cb(toErr("ENOSYS")); },
  };

  return fs;
}

function installGlobalsForGo(fs) {
  globalThis.fs = fs;
  globalThis.path = {
    resolve: (...parts) => normalizePath(parts.join("/"), fs.getCwd()),
  };
  globalThis.process = {
    env: {},
    getuid: () => 0,
    getgid: () => 0,
    geteuid: () => 0,
    getegid: () => 0,
    getgroups: () => [],
    pid: 1,
    ppid: 1,
    umask: () => 0,
    cwd: () => fs.getCwd(),
    chdir: (dir) => fs.setCwd(dir),
  };
}

async function getWasmBytes() {
  if (!wasmBytesPromise) {
    wasmBytesPromise = fetch("./pdfcpu.wasm").then(async (res) => {
      if (!res.ok) {
        throw new Error(`Unable to load pdfcpu.wasm (${res.status})`);
      }
      return res.arrayBuffer();
    });
  }
  return wasmBytesPromise;
}

function sanitizePdfText(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function buildCoverPdf(docNames, coverText) {
  const lines = [
    coverText.coverTitle,
    coverText.coverSubtitle,
    "",
    coverText.coverHeading,
  ];
  docNames.forEach((name, idx) => lines.push(`${idx + 1}. ${name}`));

  const content = [
    "BT",
    "/F1 30 Tf",
    "72 785 Td",
    `(${sanitizePdfText(lines[0])}) Tj`,
    "0 -24 Td",
    "/F1 12 Tf",
    `(${sanitizePdfText(lines[1])}) Tj`,
    "0 -38 Td",
    "/F1 13 Tf",
    `(${sanitizePdfText(lines[3])}) Tj`,
  ];

  for (let i = 4; i < lines.length; i++) {
    content.push("0 -20 Td");
    content.push(`(${sanitizePdfText(lines[i])}) Tj`);
  }

  content.push("ET");
  const stream = `${content.join("\n")}\n`;
  const streamLen = new TextEncoder().encode(stream).length;

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}endstream\nendobj\n`,
  ];

  const header = "%PDF-1.4\n";
  let offset = new TextEncoder().encode(header).length;
  const xrefOffsets = ["0000000000 65535 f "];

  for (const obj of objects) {
    xrefOffsets.push(`${String(offset).padStart(10, "0")} 00000 n `);
    offset += new TextEncoder().encode(obj).length;
  }

  const xrefStart = offset;
  const xref = `xref\n0 ${objects.length + 1}\n${xrefOffsets.join("\n")}\n`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  const pdfText = `${header}${objects.join("")}${xref}${trailer}`;
  return new TextEncoder().encode(pdfText);
}

async function runPdfcpuMerge(fs, inputPaths, outputPath, insertDivider) {
  installGlobalsForGo(fs);

  const args = ["pdfcpu.wasm", "merge"];
  if (insertDivider) {
    args.push("-d");
  }
  args.push("-c", "disable", "--", outputPath, ...inputPaths);

  const go = new Go();
  go.argv = args;
  go.env = { TMPDIR: "/tmp", HOME: "/" };

  let exitCode = 0;
  go.exit = (code) => {
    exitCode = code;
  };

  const wasmBytes = await getWasmBytes();
  const result = await WebAssembly.instantiate(wasmBytes, go.importObject);
  await go.run(result.instance);

  if (exitCode !== 0) {
    throw new Error(`pdfcpu failed with exit code ${exitCode}`);
  }
}

async function mergeWithPdfcpu(files, options) {
  const fs = createMemFS((line) => appendStatus(line));

  const inputPaths = [];
  for (let i = 0; i < files.length; i++) {
    const bytes = new Uint8Array(await files[i].arrayBuffer());
    const path = `/work/input-${i + 1}.pdf`;
    fs.writeFile(path, bytes);
    inputPaths.push(path);
  }

  if (!options.addCover) {
    await runPdfcpuMerge(fs, inputPaths, "/work/output.pdf", options.insertDivider);
    return fs.readFile("/work/output.pdf");
  }

  const coverBytes = buildCoverPdf(files.map((f) => f.name), {
    coverTitle: t("coverTitle"),
    coverSubtitle: t("coverSubtitle"),
    coverHeading: t("coverHeading"),
  });
  fs.writeFile("/work/cover.pdf", coverBytes);

  if (!options.insertDivider) {
    await runPdfcpuMerge(fs, ["/work/cover.pdf", ...inputPaths], "/work/output.pdf", false);
    return fs.readFile("/work/output.pdf");
  }

  appendStatus(t("statusPass1"));
  await runPdfcpuMerge(fs, inputPaths, "/work/docs-with-dividers.pdf", true);

  appendStatus(t("statusPass2"));
  await runPdfcpuMerge(fs, ["/work/cover.pdf", "/work/docs-with-dividers.pdf"], "/work/output.pdf", false);
  return fs.readFile("/work/output.pdf");
}

function isPdfLike(file) {
  const byType = file.type === "application/pdf";
  const byName = file.name.toLowerCase().endsWith(".pdf");
  return byType || byName;
}

function renderFileList(files) {
  els.fileList.innerHTML = "";
  files.forEach((file) => {
    const li = document.createElement("li");
    li.textContent = file.name;
    els.fileList.appendChild(li);
  });
}

els.pdfs.addEventListener("change", () => {
  const files = Array.from(els.pdfs.files || []);
  renderFileList(files.slice(0, MAX_FILES));
  if (files.length > MAX_FILES) {
    setStatusMessage("statusTooMany", { count: files.length, max: MAX_FILES });
  } else {
    setStatusMessage("statusReady");
  }
});

els.outputName.addEventListener("input", () => {
  els.outputName.dataset.edited = "true";
});

els.languageSelect.addEventListener("change", () => {
  applyTranslations(els.languageSelect.value);
});

els.mergeBtn.addEventListener("click", async () => {
  disableDownload();

  const files = Array.from(els.pdfs.files || []).slice(0, MAX_FILES);
  if (files.length < 2) {
    setStatusMessage("statusSelectAtLeast");
    return;
  }

  const invalid = files.find((file) => !isPdfLike(file));
  if (invalid) {
    setStatusMessage("statusInvalidFile", { name: invalid.name });
    return;
  }

  els.mergeBtn.disabled = true;
  setStatusMessage("statusMerging");

  try {
    const outputNameRaw = (els.outputName.value || "merged.pdf").trim().replace(/\s+/g, "_") || "merged.pdf";
    const outputName = outputNameRaw.endsWith(".pdf") ? outputNameRaw : `${outputNameRaw}.pdf`;

    const mergedBytes = await mergeWithPdfcpu(files, {
      insertDivider: els.insertDivider.checked,
      addCover: els.addCover.checked,
    });

    const blob = new Blob([mergedBytes], { type: "application/pdf" });
    enableDownload(blob, outputName);
    appendStatus(t("statusMergeComplete"));
  } catch (err) {
    appendStatus(`${t("statusErrorPrefix")}: ${err.message}`);
  } finally {
    els.mergeBtn.disabled = false;
  }
});

applyTranslations("en");
setStatusMessage("statusReady");
