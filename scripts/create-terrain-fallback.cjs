// Original raster fallback using the same contour field as the WebGL surface.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const width = 1440;
const height = 900;
const pixels = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const light = Math.max(0, 1 - Math.abs(x - width * 0.72) / width) * (y / height) * 10;
        pixels[index] = 14 + light * 0.4;
        pixels[index + 1] = 24 + light;
        pixels[index + 2] = 23 + light * 0.8;
        pixels[index + 3] = 255;
    }
}
function pixel(x, y, color, opacity) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) pixels[i + c] = pixels[i + c] * (1 - opacity) + color[c] * opacity;
}
function line(x1, y1, x2, y2, color, opacity) {
    const count = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)));
    for (let i = 0; i <= count; i++) {
        const fraction = count ? i / count : 0;
        pixel(x1 + (x2 - x1) * fraction, y1 + (y2 - y1) * fraction, color, opacity);
    }
}
for (let row = 0; row <= 82; row++) {
    const depth = row / 82;
    const baseline = 290 + Math.pow(depth, 1.5) * 690;
    const amplitude = 35 + depth * 130;
    const gold = row % 8 === 0;
    let previous;
    for (let x = 0; x <= width; x += 3) {
        const y = baseline + Math.sin(x * 0.006 + depth * 8) * amplitude + Math.cos(x * 0.010 - depth * 4) * amplitude * 0.35;
        if (previous) line(previous[0], previous[1], x, y, gold ? [208, 181, 106] : [109, 151, 133], gold ? 0.55 : 0.25);
        previous = [x, y];
    }
}
function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const name = Buffer.from(type);
    const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([size, name, data, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
const rows = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) pixels.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
fs.writeFileSync(path.resolve(__dirname, "../Images/terrain-fallback.png"), Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))
]));
console.log("Created original static terrain fallback.");
