import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.resolve(__dirname, '..', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(len, 0);

  const crcData = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (1 + width * 4));

  // Render a red badge with a white shield or power sign
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.46;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0: None

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 0, g = 0, b = 0, a = 0;

      // Outer rounded rectangle / shield shape
      const inBox = Math.abs(dx) <= radius * 0.9 && Math.abs(dy) <= radius * 0.9;
      const isCorner = Math.abs(dx) > radius * 0.6 && Math.abs(dy) > radius * 0.6;
      const cornerDist = Math.sqrt(
        Math.pow(Math.abs(dx) - radius * 0.6, 2) +
        Math.pow(Math.abs(dy) - radius * 0.6, 2)
      );

      if ((inBox && !isCorner) || (isCorner && cornerDist <= radius * 0.3)) {
        // Red badge background (#851414 -> #A51D1D)
        r = 160;
        g = 20;
        b = 20;
        a = 255;

        // Draw inner white shield / 'u' emblem
        const nx = dx / radius;
        const ny = dy / radius;

        // uBlock Origin style power emblem or shield
        const inInnerShield =
          Math.abs(nx) <= 0.55 &&
          ny >= -0.55 &&
          (ny <= 0.1 || (ny > 0.1 && Math.abs(nx) <= (0.55 - (ny - 0.1) * 0.8)));

        // Power symbol / "U" cutout
        const inUCutout =
          (Math.abs(nx) <= 0.22 && ny >= -0.35 && ny <= 0.15) ||
          (Math.abs(nx) <= 0.22 && Math.sqrt(nx * nx + (ny - 0.15) * (ny - 0.15)) <= 0.22);

        const inUBorder =
          (Math.abs(nx) <= 0.42 && ny >= -0.35 && ny <= 0.15) ||
          (Math.abs(nx) <= 0.42 && Math.sqrt(nx * nx + (ny - 0.15) * (ny - 0.15)) <= 0.42);

        if (inUBorder && !inUCutout) {
          r = 255;
          g = 255;
          b = 255;
          a = 255;
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // standard filter
  ihdr[12] = 0; // no interlace

  const idat = zlib.deflateSync(rawData);

  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    pngHeader,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', idat),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

for (const size of [16, 32, 48, 128]) {
  const pngBuf = generatePng(size);
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated ${outPath} (${size}x${size})`);
}
