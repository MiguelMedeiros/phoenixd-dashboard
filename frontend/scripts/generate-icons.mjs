#!/usr/bin/env node

/**
 * PWA Icon Generator Script
 * 
 * This script generates PNG icons from the SVG favicon for PWA.
 * Run: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// SVG content for the icon (scaled to 512x512 base)
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F97316"/>
      <stop offset="100%" style="stop-color:#EA580C"/>
    </linearGradient>
    <linearGradient id="boltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FCD34D"/>
      <stop offset="100%" style="stop-color:#FBBF24"/>
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="256" cy="256" r="240" fill="url(#bgGradient)"/>
  
  <!-- Inner glow -->
  <circle cx="256" cy="256" r="208" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="8"/>
  
  <!-- Lightning bolt -->
  <path d="M290.08 119.52L179.2 264.48H241.12L206.88 392.48L332.8 230.4H264.48L290.08 119.52Z" fill="url(#boltGradient)"/>
</svg>`;

async function generateIcons() {
  const iconsDir = path.join(__dirname, '../public/icons');
  
  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  console.log('Generating PWA icons...\n');

  const svgBuffer = Buffer.from(svgContent);

  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Created: icon-${size}x${size}.png`);
  }

  // Also create apple-touch-icon
  const appleTouchIconPath = path.join(__dirname, '../public/apple-touch-icon.png');
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(appleTouchIconPath);
  console.log(`✓ Created: apple-touch-icon.png`);

  // Create favicon.ico (using 32x32 as base)
  // Note: For a proper .ico file, you'd need a specialized library
  // This creates a 32x32 PNG that can be renamed
  const faviconPath = path.join(__dirname, '../public/favicon-32x32.png');
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(faviconPath);
  console.log(`✓ Created: favicon-32x32.png`);

  console.log('\n✅ All PWA icons generated successfully!');
}

generateIcons().catch(console.error);
