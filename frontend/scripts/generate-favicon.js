#!/usr/bin/env node
/*
Generate a centered square PNG (512x512) and favicon.ico (16/32) from a source image.
Usage:
  node scripts/generate-favicon.js <path/to/image>

This script requires the `sharp` package. Install with:
  cd frontend && npm install sharp

It will write `public/logo.png` and `app/favicon.ico`.
*/
const fs = require('fs');
const path = require('path');

async function run() {
  const sharp = require('sharp');
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: node scripts/generate-favicon.js <path/to/image>');
    process.exit(2);
  }

  const src = argv[0];
  if (!fs.existsSync(src)) {
    console.error('Source image not found:', src);
    process.exit(2);
  }

  const outDirPublic = path.join(__dirname, '..', 'public');
  const outDirApp = path.join(__dirname, '..', 'app');
  if (!fs.existsSync(outDirPublic)) fs.mkdirSync(outDirPublic, { recursive: true });

  const logoPng = path.join(outDirPublic, 'logo.png');
  const faviconIco = path.join(outDirApp, 'favicon.ico');

  // Create 512x512 centered square PNG
  await sharp(src)
    .resize({ width: 512, height: 512, fit: 'cover', position: 'centre' })
    .png({ quality: 90 })
    .toFile(logoPng);
  console.log('Wrote', logoPng);

  // Create favicon.ico with 16 and 32 sizes
  const tmp32 = path.join(outDirPublic, 'favicon-32.png');
  const tmp16 = path.join(outDirPublic, 'favicon-16.png');

  await sharp(src).resize(32, 32, { fit: 'cover', position: 'centre' }).png().toFile(tmp32);
  await sharp(src).resize(16, 16, { fit: 'cover', position: 'centre' }).png().toFile(tmp16);

  // Combine into .ico — sharp doesn't write .ico directly, but multiple pngs can be concatenated into ico via npm package 'jimp' or 'to-ico'.
  // We'll use `to-ico` if available; otherwise write 32x32 as favicon.
  try {
    const toIco = require('to-ico');
    const buf32 = fs.readFileSync(tmp32);
    const buf16 = fs.readFileSync(tmp16);
    const icoBuf = await toIco([buf32, buf16]);
    fs.writeFileSync(faviconIco, icoBuf);
    console.log('Wrote', faviconIco);
    // cleanup
    fs.unlinkSync(tmp32);
    fs.unlinkSync(tmp16);
  } catch (err) {
    // fallback: copy 32 png to app/favicon.ico (not a true .ico but browsers accept png at /favicon.ico)
    fs.copyFileSync(tmp32, faviconIco);
    console.warn('`to-ico` not installed — wrote PNG fallback to', faviconIco);
    fs.unlinkSync(tmp32);
    fs.unlinkSync(tmp16);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
