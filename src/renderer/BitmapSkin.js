import Skin from "./Skin.js";

export default class BitmapSkin extends Skin {
  constructor(renderer, image) {
    super(renderer);

    this._image = image;
    this._imageData = null;
    this._texture = null;

    this._setSizeFromImage(image);
  }

  getImageData() {
    // Make sure to handle potentially non-loaded textures
    if (!this._image.complete) return null;

    if (!this._imageData) {
      const canvas = document.createElement("canvas");
      canvas.width = this._image.naturalWidth || this._image.width;
      canvas.height = this._image.naturalHeight || this._image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this._image, 0, 0);
      // Cache image data so we can reuse it
      this._imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    return this._imageData;
  }

  getTexture() {
    // Make sure to handle potentially non-loaded textures
    const image = this._image;
    if (!image.complete) return null;

    if (this._texture === null) {
      // Use nearest-neighbor (i.e. blocky) texture filtering for bitmaps
      this._texture = super._makeTexture(image, this.gl.NEAREST);
    }
    return this._texture;
  }

  destroy() {
    if (this._texture !== null) this.gl.deleteTexture(this._texture);
  }
}
