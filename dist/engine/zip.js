/*!
 * Arash Chat Exporter — minimal ZIP writer
 * Creates stored (uncompressed) ZIP archives in the browser: used for real
 * .docx files and for Markdown bundles that contain the chat images.
 *
 * Copyright (c) 2026 Arash Makki
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  const AX = (globalThis.AX = globalThis.AX || {});
  if (AX.zip) return;

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      table[i] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const encoder = new TextEncoder();

  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof data === "string") return encoder.encode(data);
    if (data && data.buffer instanceof ArrayBuffer) return new Uint8Array(data.buffer);
    return new Uint8Array(0);
  }

  function dosTime(date) {
    const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const year = Math.max(1980, d.getFullYear());
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const day = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time: time & 0xffff, date: day & 0xffff };
  }

  /**
   * @param {Array<{name:string, data:Uint8Array|ArrayBuffer|string, date?:Date}>} entries
   * @returns {Uint8Array}
   */
  function create(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const stamp = dosTime(new Date());

    entries.forEach((entry) => {
      const nameBytes = encoder.encode(String(entry.name || "file").replace(/^\/+/, ""));
      const data = toBytes(entry.data);
      const crc = crc32(data);
      const when = entry.date ? dosTime(entry.date) : stamp;

      const header = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, when.time, true);
      view.setUint16(12, when.date, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      header.set(nameBytes, 30);

      chunks.push(header, data);

      const record = new Uint8Array(46 + nameBytes.length);
      const recordView = new DataView(record.buffer);
      recordView.setUint32(0, 0x02014b50, true);
      recordView.setUint16(4, 20, true);
      recordView.setUint16(6, 20, true);
      recordView.setUint16(8, 0x0800, true);
      recordView.setUint16(10, 0, true);
      recordView.setUint16(12, when.time, true);
      recordView.setUint16(14, when.date, true);
      recordView.setUint32(16, crc, true);
      recordView.setUint32(20, data.length, true);
      recordView.setUint32(24, data.length, true);
      recordView.setUint16(28, nameBytes.length, true);
      recordView.setUint16(30, 0, true);
      recordView.setUint16(32, 0, true);
      recordView.setUint16(34, 0, true);
      recordView.setUint16(36, 0, true);
      recordView.setUint32(38, 0, true);
      recordView.setUint32(42, offset, true);
      record.set(nameBytes, 46);
      central.push(record);

      offset += header.length + data.length;
    });

    const centralSize = central.reduce((sum, item) => sum + item.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    const total = chunks.reduce((sum, item) => sum + item.length, 0) + centralSize + end.length;
    const output = new Uint8Array(total);
    let cursor = 0;
    chunks.forEach((chunk) => {
      output.set(chunk, cursor);
      cursor += chunk.length;
    });
    central.forEach((record) => {
      output.set(record, cursor);
      cursor += record.length;
    });
    output.set(end, cursor);
    return output;
  }

  function base64ToBytes(base64) {
    const value = String(base64 || "").replace(/^data:[^,]*;base64,/i, "");
    const clean = value.replace(/\s+/g, "");
    const binary = typeof atob === "function" ? atob(clean) : Buffer.from(clean, "base64").toString("binary");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function bytesToBlob(bytes, mime) {
    return new Blob([bytes], { type: mime || "application/zip" });
  }

  AX.zip = { create, crc32, base64ToBytes, bytesToBlob, toBytes };
})();
