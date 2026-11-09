/*!
 * Arash Chat Exporter — Word (.docx) writer
 * Builds a real OOXML package (no external library) from the Markdown that
 * the extractor produces. Runs are right-to-left aware and code stays LTR.
 *
 * Copyright (c) 2026 Arash Makki
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  const AX = (globalThis.AX = globalThis.AX || {});
  if (AX.docx) return;

  const U = AX.util;
  const RTL_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const RTL_STRONG = /[\u0621-\u064A\u0660-\u0669\u06F0-\u06F9]/g;
  const LTR_STRONG = /[A-Za-z0-9]/g;

  const xmlEscape = (value) =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\u0001/g, "");

  function isRtlText(text) {
    const value = String(text || "");
    const rtl = (value.match(RTL_STRONG) || []).length;
    const ltr = (value.match(LTR_STRONG) || []).length;
    return rtl > 0 && rtl >= ltr * 0.35;
  }

  /* ----------------------------------------------------------------------- */
  /* Inline runs                                                             */
  /* ----------------------------------------------------------------------- */

  const INLINE_RE =
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~]+~~|`[^`]+`|!\[[^\]]*\]\([^)\s]+\)|\[[^\]]+\]\([^)\s]+\))/g;

  function richText(text, rels) {
    const source = String(text || "");
    const parts = [];
    let lastIndex = 0;
    source.replace(INLINE_RE, (match, token, index) => {
      if (index > lastIndex) parts.push({ text: source.slice(lastIndex, index) });
      lastIndex = index + match.length;
      if (token.startsWith("**") || token.startsWith("__")) {
        parts.push({ text: token.slice(2, -2), bold: true });
      } else if (token.startsWith("~~")) {
        parts.push({ text: token.slice(2, -2), strike: true });
      } else if (token.startsWith("`")) {
        parts.push({ text: token.slice(1, -1), code: true });
      } else if (token.startsWith("![")) {
        const alt = token.slice(2, token.indexOf("]"));
        const src = token.slice(token.indexOf("(") + 1, -1);
        parts.push({ image: { alt, src } });
      } else if (token.startsWith("[")) {
        const label = token.slice(1, token.indexOf("]"));
        const href = token.slice(token.indexOf("(") + 1, -1);
        parts.push({ text: label, href });
      } else if (token.startsWith("*") || token.startsWith("_")) {
        parts.push({ text: token.slice(1, -1), italic: true });
      }
      return match;
    });
    if (lastIndex < source.length) parts.push({ text: source.slice(lastIndex) });
    return parts.map((part) => runXml(part, rels)).join("");
  }

  function runXml(part, rels) {
    if (part.image) {
      return imageXml(part.image, rels);
    }
    const text = String(part.text || "").replace(/\u0000/g, "");
    if (!text) return "";
    const rtl = isRtlText(text);
    const props = [];
    if (part.bold) props.push("<w:b/>");
    if (part.italic) props.push("<w:i/>");
    if (part.strike) props.push("<w:strike/>");
    if (part.code) props.push('<w:rStyle w:val="CodeChar"/>');
    props.push(`<w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Tahoma"/>`);
    if (part.code) props.push('<w:noProof/>');
    if (rtl) props.push("<w:rtl/>");
    if (part.bold) props.push("<w:bCs/>");
    if (part.italic) props.push("<w:iCs/>");
    const run = `<w:r><w:rPr>${props.join("")}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
    if (part.href && /^(https?:|mailto:)/i.test(part.href)) {
      const id = rels.hyperlink(part.href);
      return `<w:hyperlink r:id="${id}" w:history="1">${run}</w:hyperlink>`;
    }
    return run;
  }

  function imageXml(image, rels) {
    const src = String(image.src || "");
    if (!/^data:image\/(png|jpe?g|gif);base64,/i.test(src)) {
      return runXml({ text: `🖼 ${image.alt || "تصویر"}${src ? ` — ${src}` : ""}` }, rels);
    }
    const embedded = rels.image(src);
    if (!embedded) return runXml({ text: `🖼 ${image.alt || "تصویر"}` }, rels);
    const cx = 5486400;
    const cy = 3657600;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${embedded.id}" name="Picture ${embedded.id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${embedded.id}" name="Picture ${embedded.id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${embedded.rel}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  /* ----------------------------------------------------------------------- */
  /* Block parsing                                                           */
  /* ----------------------------------------------------------------------- */

  function parseMarkdown(markdown) {
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const blocks = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      const fence = line.match(/^\s*(```|~~~)(.*)$/);
      if (fence) {
        const marker = fence[1];
        const lang = (fence[2] || "").trim().split(/\s+/)[0];
        const buffer = [];
        index += 1;
        while (index < lines.length && !lines[index].trim().startsWith(marker)) {
          buffer.push(lines[index]);
          index += 1;
        }
        index += 1;
        blocks.push({ type: "code", lang, text: buffer.join("\n") });
        continue;
      }

      if (!line.trim()) {
        index += 1;
        continue;
      }

      const heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
      if (heading) {
        blocks.push({ type: "heading", level: Math.min(3, heading[1].length), text: heading[2].trim() });
        index += 1;
        continue;
      }

      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        blocks.push({ type: "hr" });
        index += 1;
        continue;
      }

      if (/^\s*\|/.test(line) && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[index + 1])) {
        const rows = [];
        const header = splitRow(line);
        index += 2;
        while (index < lines.length && /^\s*\|/.test(lines[index])) {
          rows.push(splitRow(lines[index]));
          index += 1;
        }
        blocks.push({ type: "table", header, rows });
        continue;
      }

      if (/^\s*>/.test(line)) {
        const buffer = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) {
          buffer.push(lines[index].replace(/^\s*>\s?/, ""));
          index += 1;
        }
        blocks.push({ type: "quote", text: buffer.join("\n") });
        continue;
      }

      const listItem = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
      if (listItem) {
        const ordered = /\d/.test(listItem[1]);
        const items = [];
        let counter = 1;
        while (index < lines.length) {
          const current = lines[index].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
          if (!current) break;
          let text = current[2];
          let task = "";
          const check = text.match(/^\[([ xX])\]\s+(.*)$/);
          if (check) {
            task = check[1].toLowerCase() === "x" ? "☑ " : "☐ ";
            text = check[2];
          }
          items.push({ text, marker: ordered ? `${counter}.` : "•", task });
          if (ordered) counter += 1;
          index += 1;
          while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[index])) {
            items[items.length - 1].text += ` ${lines[index].trim()}`;
            index += 1;
          }
        }
        blocks.push({ type: "list", ordered, items });
        continue;
      }

      const buffer = [line];
      index += 1;
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^\s*(#{1,6})\s+/.test(lines[index]) &&
        !/^\s*(```|~~~)/.test(lines[index]) &&
        !/^\s*>/.test(lines[index]) &&
        !/^\s*([-*+]|\d+[.)])\s+/.test(lines[index]) &&
        !/^\s*\|/.test(lines[index])
      ) {
        buffer.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "paragraph", text: buffer.join("\n") });
    }
    return blocks;
  }

  function splitRow(row) {
    return row
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replace(/\\\|/g, "|"));
  }

  /* ----------------------------------------------------------------------- */
  /* OOXML                                                                   */
  /* ----------------------------------------------------------------------- */

  function paragraphXml(runs, options) {
    const opts = options || {};
    const props = [];
    if (opts.style) props.push(`<w:pStyle w:val="${opts.style}"/>`);
    if (opts.bidi) props.push("<w:bidi/>");
    if (opts.align) props.push(`<w:jc w:val="${opts.align}"/>`);
    if (opts.indent) props.push(`<w:ind w:left="${opts.indent}" w:right="${opts.indent}"/>`);
    if (opts.spacing) props.push(`<w:spacing w:before="${opts.spacing[0]}" w:after="${opts.spacing[1]}"/>`);
    const pPr = props.length ? `<w:pPr>${props.join("")}</w:pPr>` : "";
    return `<w:p>${pPr}${runs}</w:p>`;
  }

  function textParagraph(text, rels, options) {
    const bidi = isRtlText(text);
    const runs = richText(text, rels).replace(/\n/g, "</w:t></w:r><w:r><w:br/><w:t xml:space=\"preserve\">");
    return paragraphXml(runs, { bidi, ...(options || {}) });
  }

  function codeParagraph(text) {
    const lines = String(text || "").split("\n");
    const body = lines
      .map((line, index) => {
        const br = index < lines.length - 1 ? "<w:br/>" : "";
        return `<w:t xml:space="preserve">${xmlEscape(line)}</w:t>${br}`;
      })
      .join("");
    return `<w:p><w:pPr><w:pStyle w:val="Code"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:noProof/></w:rPr>${body}</w:r></w:p>`;
  }

  function tableXml(block, rels) {
    const columns = Math.max(block.header.length, ...block.rows.map((row) => row.length), 1);
    const width = Math.floor(9350 / columns);
    const cell = (value, header) =>
      `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraphXml(
        richText(value, rels),
        { bidi: isRtlText(value) }
      )}${header ? "" : ""}</w:tc>`;
    const grid = Array.from({ length: columns }, () => `<w:gridCol w:w="${width}"/>`).join("");
    const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${block.header
      .concat(Array(Math.max(0, columns - block.header.length)).fill(""))
      .map((value) => cell(value, true))
      .join("")}</w:tr>`;
    const rows = block.rows
      .map(
        (row) =>
          `<w:tr>${row
            .concat(Array(Math.max(0, columns - row.length)).fill(""))
            .map((value) => cell(value, false))
            .join("")}</w:tr>`
      )
      .join("");
    return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:bidiVisual/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${headerRow}${rows}</w:tbl><w:p/>`;
  }

  function borderParagraph() {
    return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C9CED8"/></w:pBdr></w:pPr></w:p>`;
  }

  function buildDocument(doc, options) {
    const opts = { language: "fa", includeMeta: true, includeModel: true, ...(options || {}) };
    const rels = createRels();
    const blocks = [];
    const labels = (AX.format && AX.format.LABELS[opts.language]) || {
      source: "Source",
      model: "Model",
      link: "Link",
      exportedAt: "Exported",
      messages: "Messages",
        exportedBy: "Exported with A.max by Arash Makki",
    };

    blocks.push(textParagraph(doc.title || "Chat", rels, { style: "Title", bidi: isRtlText(doc.title) }));

    if (opts.includeMeta) {
      const metaParts = [];
      if (doc.site) metaParts.push(`${labels.source}: ${doc.site}`);
      if (doc.model && opts.includeModel) metaParts.push(`${labels.model}: ${doc.model}`);
      if (doc.url) metaParts.push(`${labels.link}: ${doc.url}`);
      metaParts.push(`${labels.exportedAt}: ${U.isoStamp(doc.exportedAt)}`);
      metaParts.push(`${labels.messages}: ${doc.messages.length}`);
      blocks.push(textParagraph(metaParts.join(" · "), rels, { style: "Meta" }));
    }

    doc.messages.forEach((message, index) => {
      const roleLabels = (AX.format && AX.format.LABELS && AX.format.LABELS[opts.language]) || {};
      // Do not fall back to "Assistant": an unresolved role must stay unknown.
      const role = roleLabels[message.role] || roleLabels.unknown || "Unknown";
      const head = [`${index + 1}. ${role}`];
      if (message.model) head.push(message.model);
      blocks.push(textParagraph(head.join(" — "), rels, { style: "Role", bidi: true }));

      parseMarkdown(message.markdown || "").forEach((block) => {
        switch (block.type) {
          case "heading":
            blocks.push(
              textParagraph(block.text, rels, {
                style: `Heading${block.level}`,
                bidi: isRtlText(block.text),
              })
            );
            break;
          case "code":
            blocks.push(codeParagraph(block.text));
            break;
          case "list":
            block.items.forEach((item) => {
              const text = `${item.task || ""}${item.marker} ${item.text}`;
              blocks.push(
                paragraphXml(richText(text, rels), {
                  bidi: isRtlText(item.text),
                  indent: 360,
                  spacing: [0, 60],
                })
              );
            });
            break;
          case "quote":
            blocks.push(textParagraph(block.text, rels, { style: "Quote", bidi: isRtlText(block.text) }));
            break;
          case "table":
            blocks.push(tableXml(block, rels));
            break;
          case "hr":
            blocks.push(borderParagraph());
            break;
          default: {
            const parts = block.text.split("\n");
            blocks.push(
              paragraphXml(
                parts.map((line, i) => richText(line, rels) + (i < parts.length - 1 ? '<w:r><w:br/></w:r>' : "")).join(""),
                { bidi: isRtlText(block.text) }
              )
            );
          }
        }
      });
    });

    blocks.push(textParagraph(`${labels.exportedBy} — Arash Makki`, rels, { style: "Meta", bidi: true }));

    const body = `${blocks.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;

    return {
      document: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body>${body}</w:body></w:document>`,
      rels: rels.xml(),
      media: rels.media(),
      relationships: rels.list,
    };
  }

  function createRels() {
    const list = [];
    const media = [];
    let counter = 0;
    let imageCounter = 0;
    return {
      list,
      hyperlink(url) {
        counter += 1;
        const id = `rIdLink${counter}`;
        list.push(
          `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(
            url
          )}" TargetMode="External"/>`
        );
        return id;
      },
      image(dataUrl) {
        const match = String(dataUrl).match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);
        if (!match) return null;
        imageCounter += 1;
        const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
        const name = `image${imageCounter}.${ext}`;
        const bytes = AX.zip.base64ToBytes(match[2]);
        media.push({ name: `word/media/${name}`, data: bytes });
        const rel = `rIdImg${imageCounter}`;
        list.push(
          `<Relationship Id="${rel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`
        );
        return { rel, id: imageCounter };
      },
      media() {
        return media;
      },
      xml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.join("")}</Relationships>`;
      },
    };
  }

  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Tahoma"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:bidi="fa-IR"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="280" w:after="140"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="1F2937"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="1F2937"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F4F5F8"/><w:spacing w:before="60" w:after="120"/><w:ind w:left="120" w:right="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="6B7280"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Role"><w:name w:val="Role"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="D7DBE5"/></w:pBdr></w:pPr><w:rPr><w:b/><w:color w:val="3730A3"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="12" w:space="6" w:color="A5B4FC"/></w:pBdr><w:ind w:left="240"/></w:pPr><w:rPr><w:color w:val="374151"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:color="auto" w:fill="F1F2F6"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/></w:tblBorders></w:tblPr></w:style>
</w:styles>`;

  function build(doc, options) {
    const built = buildDocument(doc, options);
    const title = xmlEscape(doc.title || "Chat");
    const application = (AX && AX.generator) || "A.max";
    const appVersion = (AX && AX.version) || "";
    const entries = [
      {
        name: "[Content_Types].xml",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
      },
      {
        name: "_rels/.rels",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
      },
      { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${title}</dc:title><dc:creator>Arash Makki</dc:creator><cp:lastModifiedBy>${application}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>` },
      { name: "docProps/app.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>${application}</Application>${appVersion ? `<AppVersion>${appVersion}</AppVersion>` : ""}<Company>Arash Makki</Company><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${title}</vt:lpstr></vt:vector></TitlesOfParts></Properties>` },
      { name: "word/document.xml", data: built.document },
      { name: "word/styles.xml", data: STYLES },
      { name: "word/_rels/document.xml.rels", data: built.rels },
      ...built.media,
    ];
    return AX.zip.create(entries);
  }

  AX.docx = { build, parseMarkdown, isRtlText };
})();
