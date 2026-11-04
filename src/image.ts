export interface LoadedImage {
  url: string;
  name: string;
  bytes: number;
  width: number;
  height: number;
  /** DPI written in the file metadata (JFIF / EXIF / PNG pHYs), if any. */
  embeddedDpi: number | null;
}

export class ImageLoadError extends Error {
  constructor(public code: 'notImage' | 'decode' | 'heic') {
    super(code);
  }
}

const HEIC = /\.(heic|heif)$/i;

export async function loadImage(file: File): Promise<LoadedImage> {
  const isHeic = HEIC.test(file.name) || /heic|heif/i.test(file.type);
  if (!file.type.startsWith('image/') && !isHeic && !/\.(jpe?g|png|webp|avif|gif|bmp|tiff?)$/i.test(file.name)) {
    throw new ImageLoadError('notImage');
  }
  const url = URL.createObjectURL(file);
  try {
    const { width, height } = await decode(url);
    const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    return { url, name: file.name, bytes: file.size, width, height, embeddedDpi: readDpi(head) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageLoadError(isHeic ? 'heic' : 'decode');
  }
}

function decode(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      img.naturalWidth > 0 ? resolve({ width: img.naturalWidth, height: img.naturalHeight }) : reject();
    img.onerror = reject;
    img.src = url;
  });
}

/** Generates a 6000×4000 demo image (24 MP, a common camera resolution). */
export async function sampleImage(): Promise<File> {
  const w = 6000;
  const h = 4000;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2b1d5c');
  sky.addColorStop(0.45, '#c2577a');
  sky.addColorStop(0.7, '#f5a35c');
  sky.addColorStop(1, '#ffd9a0');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,240,210,.95)';
  g.beginPath();
  g.arc(w * 0.62, h * 0.62, h * 0.13, 0, Math.PI * 2);
  g.fill();
  const hills: [string, number, number][] = [
    ['#7b3f6e', 0.66, 0.08],
    ['#4c2a5e', 0.74, 0.1],
    ['#26193f', 0.84, 0.07],
  ];
  for (const [color, base, amp] of hills) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 40) {
      g.lineTo(x, h * (base - amp * Math.sin(x / (w / 3.2) + base * 9) * Math.cos(x / (w / 7.5))));
    }
    g.lineTo(w, h);
    g.fill();
  }
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.85));
  return new File([blob], 'sample-6000x4000.jpg', { type: 'image/jpeg' });
}

// ---------- metadata DPI ----------

function readDpi(b: Uint8Array): number | null {
  try {
    if (b[0] === 0x89 && b[1] === 0x50) return pngDpi(b);
    if (b[0] === 0xff && b[1] === 0xd8) return jpegDpi(b);
  } catch {
    /* malformed metadata – ignore */
  }
  return null;
}

function pngDpi(b: Uint8Array): number | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let off = 8;
  while (off + 12 <= b.length) {
    const len = dv.getUint32(off);
    const type = String.fromCharCode(b[off + 4], b[off + 5], b[off + 6], b[off + 7]);
    if (type === 'pHYs' && off + 17 <= b.length) {
      const ppu = dv.getUint32(off + 8);
      return b[off + 16] === 1 ? Math.round(ppu * 0.0254) : null;
    }
    if (type === 'IDAT' || type === 'IEND') return null;
    off += 12 + len;
  }
  return null;
}

function jpegDpi(b: Uint8Array): number | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let off = 2;
  let jfif: number | null = null;
  while (off + 4 <= b.length && b[off] === 0xff) {
    const marker = b[off + 1];
    const len = dv.getUint16(off + 2);
    const seg = off + 4;
    if (marker === 0xe0 && str(b, seg, 5) === 'JFIF\0') {
      const unit = b[seg + 7];
      const x = dv.getUint16(seg + 8);
      if (unit === 1) jfif = x;
      else if (unit === 2) jfif = Math.round(x * 2.54);
    } else if (marker === 0xe1 && str(b, seg, 6) === 'Exif\0\0') {
      const exif = exifDpi(dv, seg + 6);
      if (exif) return exif;
    } else if (marker === 0xda) break;
    off += 2 + len;
  }
  return jfif;
}

function exifDpi(dv: DataView, tiff: number): number | null {
  const le = dv.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => dv.getUint16(tiff + o, le);
  const u32 = (o: number) => dv.getUint32(tiff + o, le);
  const ifd = u32(4);
  const count = u16(ifd);
  let xres: number | null = null;
  let unit = 2;
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    if (tag === 0x011a) {
      const p = u32(e + 8);
      const den = u32(p + 4);
      if (den) xres = u32(p) / den;
    } else if (tag === 0x0128) unit = u16(e + 8);
  }
  if (!xres) return null;
  return Math.round(unit === 3 ? xres * 2.54 : xres);
}

const str = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
