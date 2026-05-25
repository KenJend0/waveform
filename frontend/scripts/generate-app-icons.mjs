#!/usr/bin/env node
/**
 * Génère les icônes natives pour Android (mipmap) et iOS (AppIcon.appiconset)
 * depuis public/icon-512.png et public/icon-maskable.png
 *
 * Usage: node scripts/generate-app-icons.mjs
 */
import sharp from 'sharp';
import { copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const src        = join(root, 'public', 'icon-512.png');
const srcMaskable = join(root, 'public', 'icon-maskable.png');
const androidRes  = join(root, 'android', 'app', 'src', 'main', 'res');
const iosIconset  = join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');

// Android densities
// launcher size = taille de l'icône affichée
// fg size = taille du calque foreground adaptive icon (108dp base × ratio)
const densities = [
  { dir: 'mipmap-mdpi',     size: 48,  fgSize: 108 },
  { dir: 'mipmap-hdpi',     size: 72,  fgSize: 162 },
  { dir: 'mipmap-xhdpi',    size: 96,  fgSize: 216 },
  { dir: 'mipmap-xxhdpi',   size: 144, fgSize: 324 },
  { dir: 'mipmap-xxxhdpi',  size: 192, fgSize: 432 },
];

console.log('→ Android icons…');
for (const d of densities) {
  const dir = join(androidRes, d.dir);

  await sharp(src).resize(d.size, d.size).png().toFile(join(dir, 'ic_launcher.png'));
  await sharp(src).resize(d.size, d.size).png().toFile(join(dir, 'ic_launcher_round.png'));
  await sharp(srcMaskable).resize(d.fgSize, d.fgSize).png().toFile(join(dir, 'ic_launcher_foreground.png'));

  console.log(`  ✓ ${d.dir} (${d.size}px launcher / ${d.fgSize}px foreground)`);
}

console.log('→ iOS icon…');
copyFileSync(
  join(root, 'public', 'icon-1024.png'),
  join(iosIconset, 'AppIcon-512@2x.png')
);
console.log('  ✓ AppIcon-512@2x.png (1024×1024)');

console.log('Done.');
