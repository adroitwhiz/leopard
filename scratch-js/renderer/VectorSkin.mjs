import Skin from "./Skin.mjs";

// This means that the smallest mipmap will be 1/(2**4)th the size of the sprite's "100%" size.
const MIPMAP_OFFSET = 4;

export default class VectorSkin extends Skin {
  constructor (renderer, image) {
    super(renderer);

    this._image = image;
    this._canvas = document.createElement('canvas');

    this._mipmaps = new Map();
  }

  // TODO: handle proper subpixel positioning when SVG viewbox has non-integer coordinates
  _createMipmap (mipLevel) {
    const scale = 2 ** (mipLevel - MIPMAP_OFFSET);

    // Instead of uploading the image to WebGL as a texture, render the image to a canvas and upload the canvas.
    const canvas = this._canvas;
    const ctx = canvas.getContext('2d');

    const image = this._image;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(image, 0, 0, width, height);

    const gl = this.gl;
    const glTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glTexture);
    // These need to be set because most sprite textures don't have power-of-two dimensions.
    // Non-power-of-two textures only work with gl.CLAMP_TO_EDGE wrapping behavior,
    // and because they don't support automatic mipmaps, can only use non-mipmap texture filtering.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Use linear (e.g. smooth) texture filtering for vectors
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      canvas
    );

    this._mipmaps.set(mipLevel, glTexture);
  }

  getTexture (scale) {
    const image = this._image;
    if (!image.complete) return null;

    const gl = this.gl;

    // Because WebGL doesn't support vector graphics, substitute a bunch of bitmaps.
    // This skin contains several renderings of its image at different scales.
    // We render the SVG at 0.5x scale, 1x scale, 2x scale, 4x scale, etc. and store those as textures,
    // so we can use the properly-sized texture for whatever scale we're currently rendering at.
    // Math.ceil(Math.log2(scale)) means we use the "2x" texture at 1x-2x scale, the "4x" texture at 2x-4x scale, etc.
    // This means that one texture pixel will always be between 0.5x and 1x the size of one rendered pixel,
    // but never bigger than one rendered pixel--this prevents blurriness from blowing up the texture too much.
    const mipLevel = Math.max(Math.ceil(Math.log2(scale)) + MIPMAP_OFFSET, 0);
    if (!this._mipmaps.has(mipLevel)) this._createMipmap(mipLevel);

    return this._mipmaps.get(mipLevel);
  }

  destroy () {
    for (const mip of this._mipmaps.values()) {
      //console.log(mip);
      this.gl.deleteTexture(mip);
    }
  }
}