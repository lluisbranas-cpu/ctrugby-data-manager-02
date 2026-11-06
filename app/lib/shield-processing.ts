import sharp from "sharp";

function removeConnectedBackground(input: Buffer, width: number, height: number) {
  const output = Buffer.from(input);
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const stack: number[] = [];
  const cornerIndexes = [0, width - 1, (height - 1) * width, (height * width) - 1].filter((index) => index >= 0 && index < pixelCount);
  const corner = cornerIndexes.reduce((sum, index) => {
    const offset = index * 4;
    return { r: sum.r + input[offset], g: sum.g + input[offset + 1], b: sum.b + input[offset + 2], a: sum.a + input[offset + 3] };
  }, { r: 0, g: 0, b: 0, a: 0 });
  const samples = Math.max(1, cornerIndexes.length);
  const background = { r: corner.r / samples, g: corner.g / samples, b: corner.b / samples, a: corner.a / samples };
  const colorDistanceFromBackground = (index: number) => {
    const offset = index * 4;
    return Math.hypot(input[offset] - background.r, input[offset + 1] - background.g, input[offset + 2] - background.b);
  };
  const isTransparent = (index: number) => input[index * 4 + 3] < 12;
  const isNearWhite = (index: number) => {
    const offset = index * 4;
    const r = input[offset], g = input[offset + 1], b = input[offset + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return min > 238 && max - min < 22;
  };
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let index = 0; index < pixelCount; index++) {
    if (isTransparent(index) || isNearWhite(index) || colorDistanceFromBackground(index) < 44) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const darkBackground = background.r + background.g + background.b < 80;
  const hasForegroundEnvelope = maxX >= minX && maxY >= minY && (maxX - minX) > width * .35 && (maxY - minY) > height * .35;
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const protectedRadius = hasForegroundEnvelope
    ? Math.max(maxX - minX, maxY - minY) / 2 - Math.max(8, Math.max(maxX - minX, maxY - minY) * .06)
    : 0;
  const isProtectedInterior = (index: number) => {
    if (!darkBackground || !hasForegroundEnvelope) return false;
    const x = index % width;
    const y = Math.floor(index / width);
    return Math.hypot(x - center.x, y - center.y) < protectedRadius;
  };
  const isBackground = (index: number) => {
    if (isProtectedInterior(index)) return false;
    const offset = index * 4;
    const a = input[offset + 3];
    if (a < 12) return true;
    const nearCorner = colorDistanceFromBackground(index) < 44 && Math.abs(a - background.a) < 70;
    return isNearWhite(index) || nearCorner;
  };
  const push = (index: number) => {
    if (index < 0 || index >= pixelCount || visited[index] || !isBackground(index)) return;
    visited[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    push(y * width);
    push((y * width) + width - 1);
  }
  while (stack.length) {
    const index = stack.pop()!;
    const x = index % width;
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (index >= width) push(index - width);
    if (index < pixelCount - width) push(index + width);
  }
  for (let index = 0; index < pixelCount; index++) {
    if (!visited[index]) continue;
    const offset = index * 4;
    output[offset] = 0;
    output[offset + 1] = 0;
    output[offset + 2] = 0;
    output[offset + 3] = 0;
  }
  return output;
}

function alphaBoundingBox(input: Buffer, width: number, height: number) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (input[((y * width) + x) * 4 + 3] < 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export async function prepareShield(bytes: Buffer, removeBackground: boolean) {
  const normalized = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate()
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const shieldPixels = removeBackground ? removeConnectedBackground(normalized.data, normalized.info.width, normalized.info.height) : normalized.data;
  const box = alphaBoundingBox(shieldPixels, normalized.info.width, normalized.info.height);
  const trimmed = box
    ? sharp(shieldPixels, { raw: { width: normalized.info.width, height: normalized.info.height, channels: 4 } }).extract(box)
    : sharp(shieldPixels, { raw: { width: normalized.info.width, height: normalized.info.height, channels: 4 } });
  const prepared = await trimmed
    .resize(284, 284, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: false })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 }).toBuffer();
  return prepared;
}

