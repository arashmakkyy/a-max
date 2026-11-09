/*!
 * Arash Chat Exporter — "Markdown + images" packer
 * Turns a conversation into a Markdown archive in one of three modes:
 *   zip    → conversation.md + images/ + metadata.json
 *   base64 → a single .md file with embedded images
 *   url    → a single .md file that keeps the original image links
 *
 * Copyright (c) 2026 Arash Makki
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  const AX = (globalThis.AX = globalThis.AX || {});
  if (AX.bundle) return;

  const IMAGE_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;

  function imageUrls(markdown) {
    const urls = [];
    const seen = new Set();
    let match;
    IMAGE_RE.lastIndex = 0;
    while ((match = IMAGE_RE.exec(markdown))) {
      if (seen.has(match[2])) continue;
      seen.add(match[2]);
      urls.push(match[2]);
    }
    return urls;
  }

  async function fetchImage(url, limit) {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error("bad status");
    const type = response.headers.get("content-type") || "";
    if (!/^image\//.test(type)) throw new Error("not an image");
    const blob = await response.blob();
    if (blob.size > (limit || 4_000_000)) throw new Error("too large");
    return blob;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
  }

  function metadata(doc) {
    return JSON.stringify(
      {
        title: doc.title,
        url: doc.url,
        site: doc.site,
        model: doc.model,
        messages: doc.messages.length,
        exportedAt: new Date().toISOString(),
        generator: AX.generator || "A.max",
        author: "Arash Makki",
      },
      null,
      2
    );
  }

  /**
   * @returns {Promise<{kind:"md"|"zip", content?:string, blob?:Blob, filename:string, embedded:number, packed:number}>}
   */
  async function markdownBundle(doc, options, mode) {
    const opts = options || {};
    const chosen = mode === "base64" || mode === "url" ? mode : "zip";
    const rendered = AX.format.render(doc, "markdown", opts);
    const markdown = rendered.content;
    const urls = imageUrls(markdown);

    if (chosen === "url") {
      return { kind: "md", content: markdown, filename: rendered.filename, embedded: 0, packed: 0 };
    }

    if (chosen === "base64") {
      let text = markdown;
      let embedded = 0;
      for (const url of urls) {
        try {
          const dataUrl = await blobToDataUrl(await fetchImage(url, 4_000_000));
          if (!dataUrl) continue;
          text = text.split(url).join(dataUrl);
          embedded += 1;
        } catch {
          /* a blocked host keeps its original URL */
        }
      }
      return { kind: "md", content: text, filename: rendered.filename, embedded, packed: 0 };
    }

    let text = markdown;
    const entries = [];
    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];
      try {
        const blob = await fetchImage(url, 6_000_000);
        const type = blob.type || "image/png";
        const ext = (type.split("/")[1] || "png").split(";")[0].replace("jpeg", "jpg");
        const name = `images/image-${i + 1}.${ext}`;
        entries.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
        text = text.split(url).join(name);
      } catch {
        /* keep the original URL when the host blocks the request */
      }
    }
    entries.unshift({ name: "conversation.md", data: text });
    entries.push({ name: "metadata.json", data: metadata(doc) });
    const base = AX.format.filename(doc, opts, ".zip").replace(/\.zip$/i, "");
    return {
      kind: "zip",
      blob: AX.zip.bytesToBlob(AX.zip.create(entries), "application/zip"),
      filename: `${base}.zip`,
      embedded: 0,
      packed: entries.length - 2,
    };
  }

  AX.bundle = { markdownBundle, imageUrls };
})();
