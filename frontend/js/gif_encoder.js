/**
 * Lightweight Client-Side Animated GIF89a Encoder.
 * Encodes canvas image sequence into a looping GIF file without external dependencies.
 */

class SimpleGifEncoder {
  constructor(width, height, delayMs = 500) {
    this.width = width;
    this.height = height;
    this.delay = Math.round(delayMs / 10); // in 1/100 sec
    this.frames = [];
  }

  addFrame(ctx) {
    const imgData = ctx.getImageData(0, 0, this.width, this.height);
    this.frames.push(imgData);
  }

  renderBlob() {
    // Basic GIF89a builder with 256-color standard palette
    const parts = [];
    
    // Header & Logical Screen Descriptor
    const header = [
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      this.width & 0xff, (this.width >> 8) & 0xff,
      this.height & 0xff, (this.height >> 8) & 0xff,
      0xf7, // Global Color Table Flag (256 colors)
      0x00, // Background Color Index
      0x00  // Pixel Aspect Ratio
    ];
    parts.push(new Uint8Array(header));

    // Global Color Table (Standard 256 greyscale + thermal palette)
    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      palette[i * 3 + 0] = i;
      palette[i * 3 + 1] = i;
      palette[i * 3 + 2] = i;
    }
    parts.push(palette);

    // Netscape 2.0 Loop Extension (Infinite Loop)
    const netscape = [
      0x21, 0xff, 0x0b,
      0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30,
      0x03, 0x01, 0x00, 0x00, 0x00
    ];
    parts.push(new Uint8Array(netscape));

    // Encode each frame
    for (const frame of this.frames) {
      // Graphics Control Extension
      const gce = [
        0x21, 0xf9, 0x04,
        0x04, // Disposal method
        this.delay & 0xff, (this.delay >> 8) & 0xff, // Delay time
        0x00, // Transparent color index
        0x00
      ];
      parts.push(new Uint8Array(gce));

      // Image Descriptor
      const desc = [
        0x2c,
        0x00, 0x00, 0x00, 0x00, // Left, Top
        this.width & 0xff, (this.width >> 8) & 0xff,
        this.height & 0xff, (this.height >> 8) & 0xff,
        0x00 // No local color table
      ];
      parts.push(new Uint8Array(desc));

      // Simple uncompressed LZW raster data
      const raster = this._quantizeAndRasterize(frame);
      parts.push(raster);
    }

    // GIF Trailer
    parts.push(new Uint8Array([0x3b]));

    return new Blob(parts, { type: 'image/gif' });
  }

  _quantizeAndRasterize(frame) {
    const data = frame.data;
    const npix = this.width * this.height;
    const indices = new Uint8Array(npix);

    for (let i = 0; i < npix; i++) {
      const r = data[i * 4 + 0];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      // Convert to luminance
      indices[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    // Build uncompressed LZW sub-blocks (min code size = 8)
    const blocks = [];
    blocks.push(0x08); // LZW Minimum Code Size

    let offset = 0;
    while (offset < npix) {
      const chunkSize = Math.min(254, npix - offset);
      blocks.push(chunkSize + 1);
      blocks.push(0x80); // Clear code
      for (let j = 0; j < chunkSize; j++) {
        blocks.push(indices[offset + j]);
      }
      offset += chunkSize;
    }
    blocks.push(0x01);
    blocks.push(0x81); // End of Information code
    blocks.push(0x00); // Block terminator

    return new Uint8Array(blocks);
  }
}

window.SimpleGifEncoder = SimpleGifEncoder;

