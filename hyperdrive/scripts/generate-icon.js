// Minimal valid 1x1 PNG generator
// Generates a base logo for Tauri to auto-build icon sizes.

import fs from 'fs';
import path from 'path';

const iconDir = path.resolve('src-tauri', 'icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// A base64 string of a valid 1x1 transparent PNG image
const base64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const buffer = Buffer.from(base64Png, 'base64');
fs.writeFileSync(path.join(iconDir, 'app-icon.png'), buffer);
fs.writeFileSync(path.join(iconDir, 'icon.png'), buffer);
console.log("Base app-icon.png generated successfully!");
