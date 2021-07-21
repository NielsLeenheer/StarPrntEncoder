const iconv = require('iconv-lite');
const linewrap = require('linewrap');
const {createCanvas} = require('canvas');
const Dither = require('canvas-dither');
const Flatten = require('canvas-flatten');


/**
 * Create a byte stream based on commands for ESC/POS printers
 */
class StarPrntEncoder {
  /**
     * Create a new object
     *
    */
  constructor() {
    this._reset();
  }

  /**
     * Reset the state of the object
     *
    */
  _reset() {
    this._buffer = [];
    this._codepage = 'ascii';

    this._state = {
      'bold': false,
      'underline': false,
    };
  }

  /**
     * Encode a string with the current code page
     *
     * @param  {string}   value  String to encode
     * @return {object}          Encoded string as a ArrayBuffer
     *
    */
  _encode(value) {
    return iconv.encode(value, this._codepage);
  }

  /**
     * Add commands to the buffer
     *
     * @param  {array}   value  And array of numbers, arrays, buffers or Uint8Arrays to add to the buffer
     *
    */
  _queue(value) {
    value.forEach((item) => this._buffer.push(item));
  }

  /**
     * Initialize the printer
     *
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  initialize() {
    this._queue([
      0x1b, 0x40, 0x18,
    ]);

    return this;
  }

  /**
     * Change the code page
     *
     * @param  {string}   value  The codepage that we set the printer to
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  codepage(value) {
    const codepages = {
      'cp437': 0x01,
      'cp858': 0x04,
      'cp852': 0x05,
      'cp860': 0x06,
      'cp861': 0x07,
      'cp863': 0x08,
      'cp865': 0x09,
      'cp866': 0x0a,
      'cp855': 0x0b,
      'cp857': 0x0c,
      'cp862': 0x0d,
      'cp864': 0x0e,
      'cp737': 0x0f,
      'cp869': 0x11,
      'windows874': 0x14,
      'windows1252': 0x20,
      'windows1250': 0x21,
      'windows1251': 0x22,
    };

    let codepage;

    if (!iconv.encodingExists(value)) {
      throw new Error('Unknown codepage');
    }

    if (value in iconv.encodings) {
      if (typeof iconv.encodings[value] === 'string') {
        codepage = iconv.encodings[value];
      } else {
        codepage = value;
      }
    } else {
      throw new Error('Unknown codepage');
    }

    if (typeof codepages[codepage] !== 'undefined') {
      this._codepage = codepage;

      this._queue([
        0x1b, 0x1d, 0x74, codepages[codepage],
      ]);
    } else {
      throw new Error('Codepage not supported by printer');
    }

    return this;
  }

  /**
     * Print text
     *
     * @param  {string}   value  Text that needs to be printed
     * @param  {number}   wrap   Wrap text after this many positions
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  text(value, wrap) {
    if (wrap) {
      const w = linewrap(wrap, {lineBreak: '\r\n'});
      value = w(value);
    }

    const bytes = this._encode(value);

    this._queue([
      bytes,
    ]);

    return this;
  }

  /**
     * Print a newline
     *
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  newline() {
    this._queue([
      0x0a, 0x0d,
    ]);

    return this;
  }

  /**
     * Print text, followed by a newline
     *
     * @param  {string}   value  Text that needs to be printed
     * @param  {number}   wrap   Wrap text after this many positions
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  line(value, wrap) {
    this.text(value, wrap);
    this.newline();

    return this;
  }

  /**
     * Underline text
     *
     * @param  {boolean|number}   value  true to turn on underline, false to turn off
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  underline(value) {
    if (typeof value === 'undefined') {
      value = ! this._state.underline;
    }

    this._state.underline = value;

    this._queue([
      0x1b, 0x2d, Number(value),
    ]);

    return this;
  }

  /**
     * Italic text
     * This is a no-op for StarPRNT, as this is not supported by printers.
     * This function is for compatibility with EscPosEncoder, which does support italic.
     *
     * @param  {boolean}          value  true to turn on italic, false to turn off
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  italic(value) {
    return this;
  }

  /**
     * Bold text
     *
     * @param  {boolean}          value  true to turn on bold, false to turn off
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  bold(value) {
    if (typeof value === 'undefined') {
      value = ! this._state.bold;
    }

    this._state.bold = value;

    if (value) {
      this._queue([
        0x1b, 0x45,
      ]);
    } else {
      this._queue([
        0x1b, 0x46,
      ]);
    }

    return this;
  }

  /**
     * Change text size
     *
     * @param  {string}          value   smaller, small or normal
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  size(value) {
    if (value === 'smaller') {
      value = 0x02;
    } else if (value === 'small') {
      value = 0x01;
    } else {
      value = 0x00;
    }

    this._queue([
      0x1b, 0x1e, 0x46, value,
    ]);

    return this;
  }

  /**
     * Change text alignment
     *
     * @param  {string}          value   left, center or right
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  align(value) {
    const alignments = {
      'left': 0x00,
      'center': 0x01,
      'right': 0x02,
    };

    if (value in alignments) {
      this._queue([
        0x1b, 0x1d, 0x61, alignments[value],
      ]);
    } else {
      throw new Error('Unknown alignment');
    }

    return this;
  }

  /**
     * Barcode
     *
     * @param  {string}           value  the value of the barcode
     * @param  {string}           symbology  the type of the barcode
     * @param  {number}           height  height of the barcode
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  barcode(value, symbology, height) {
    const symbologies = {
      'upce': 0x00,
      'upca': 0x01,
      'ean8': 0x02,
      'ean13': 0x03,
      'code39': 0x04,
      'itf': 0x05,
      'code128': 0x06,
      'code93': 0x07,
      'nw-7': 0x08,
      'gs1-128': 0x09,
      'gs1-databar-omni': 0x0a,
      'gs1-databar-truncated': 0x0b,
      'gs1-databar-limited': 0x0c,
      'gs1-databar-expanded': 0x0d,
    };

    if (symbology in symbologies) {
      const bytes = iconv.encode(value, 'ascii');

      this._queue([
        0x1b, 0x62,
        symbologies[symbology], 0x01, 0x03, height,
        bytes, 0x1e,
      ]);
    } else {
      throw new Error('Symbology not supported by printer');
    }

    return this;
  }

  /**
     * QR code
     *
     * @param  {string}           value  the value of the qr code
     * @param  {number}           model  model of the qrcode, either 1 or 2
     * @param  {number}           size   size of the qrcode, a value between 1 and 8
     * @param  {string}           errorlevel  the amount of error correction used, either 'l', 'm', 'q', 'h'
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  qrcode(value, model, size, errorlevel) {
    /* Force printing the print buffer and moving to a new line */

    this._queue([
      0x0a,
    ]);

    /* Model */

    const models = {
      1: 0x01,
      2: 0x02,
    };

    if (typeof model === 'undefined') {
      model = 2;
    }

    if (model in models) {
      this._queue([
        0x1b, 0x1d, 0x79, 0x53, 0x30, models[model],
      ]);
    } else {
      throw new Error('Model must be 1 or 2');
    }

    /* Size */

    if (typeof size === 'undefined') {
      size = 6;
    }

    if (typeof size !== 'number') {
      throw new Error('Size must be a number');
    }

    if (size < 1 || size > 8) {
      throw new Error('Size must be between 1 and 8');
    }

    this._queue([
      0x1b, 0x1d, 0x79, 0x53, 0x32, size,
    ]);

    /* Error level */

    const errorlevels = {
      'l': 0x00,
      'm': 0x01,
      'q': 0x02,
      'h': 0x03,
    };

    if (typeof errorlevel === 'undefined') {
      errorlevel = 'm';
    }

    if (errorlevel in errorlevels) {
      this._queue([
        0x1b, 0x1d, 0x79, 0x53, 0x31, errorlevels[errorlevel],
      ]);
    } else {
      throw new Error('Error level must be l, m, q or h');
    }

    /* Data */

    const bytes = iconv.encode(value, 'iso88591');
    const length = bytes.length; // + 3;

    this._queue([
      0x1b, 0x1d, 0x79, 0x44, 0x31, 0x00, length % 0xff, length / 0xff, bytes,
      // 0x1b, 0x1d, 0x79, 0x33, 0x31, 0x00, length % 0xff, length / 0xff, bytes
      // 0x1d, 0x28, 0x6b, length % 0xff, length / 0xff, 0x31, 0x50, 0x30, bytes,
    ]);

    /* Print QR code */

    this._queue([
      0x1b, 0x1d, 0x79, 0x50,
    ]);

    return this;
  }

  /**
     * Image
     *
     * @param  {object}         element  an element, like a canvas or image that needs to be printed
     * @param  {number}         width  width of the image on the printer
     * @param  {number}         height  height of the image on the printer
     * @param  {string}         algorithm  the dithering algorithm for making the image black and white
     * @param  {number}         threshold  threshold for the dithering algorithm
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  image(element, width, height, algorithm, threshold) {
    if (width % 8 !== 0) {
      throw new Error('Width must be a multiple of 8');
    }

    if (height % 24 !== 0) {
      throw new Error('Height must be a multiple of 24');
    }

    if (typeof algorithm === 'undefined') {
      algorithm = 'threshold';
    }

    if (typeof threshold === 'undefined') {
      threshold = 128;
    }

    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.drawImage(element, 0, 0, width, height);
    let image = context.getImageData(0, 0, width, height);

    image = Flatten.flatten(image, [0xff, 0xff, 0xff]);

    switch (algorithm) {
      case 'threshold': image = Dither.threshold(image, threshold); break;
      case 'bayer': image = Dither.bayer(image, threshold); break;
      case 'floydsteinberg': image = Dither.floydsteinberg(image); break;
      case 'atkinson': image = Dither.atkinson(image); break;
    }

    const getPixel = (x, y) => image.data[((width * y) + x) * 4] > 0 ? 0 : 1;


    this._queue([
      0x1b, 0x30,
    ]);

    for (let s = 0; s < height / 24; s++) {
      const y = s * 24;
      const bytes = new Uint8Array(width * 3);

      for (let x = 0; x < width; x++) {
        const i = x * 3;

        bytes[i] =
            getPixel(x, y + 0) << 7 |
            getPixel(x, y + 1) << 6 |
            getPixel(x, y + 2) << 5 |
            getPixel(x, y + 3) << 4 |
            getPixel(x, y + 4) << 3 |
            getPixel(x, y + 5) << 2 |
            getPixel(x, y + 6) << 1 |
            getPixel(x, y + 7);

        bytes[i + 1] =
            getPixel(x, y + 8) << 7 |
            getPixel(x, y + 9) << 6 |
            getPixel(x, y + 10) << 5 |
            getPixel(x, y + 11) << 4 |
            getPixel(x, y + 12) << 3 |
            getPixel(x, y + 13) << 2 |
            getPixel(x, y + 14) << 1 |
            getPixel(x, y + 15);

        bytes[i + 2] =
            getPixel(x, y + 16) << 7 |
            getPixel(x, y + 17) << 6 |
            getPixel(x, y + 18) << 5 |
            getPixel(x, y + 19) << 4 |
            getPixel(x, y + 20) << 3 |
            getPixel(x, y + 21) << 2 |
            getPixel(x, y + 22) << 1 |
            getPixel(x, y + 23);
      }

      this._queue([
        0x1b, 0x58,
        width & 0xff, ((width >> 8) & 0xff),
        bytes,
        0x0a, 0x0d,
      ]);
    }

    this._queue([
      0x1b, 0x7a, 0x01,
    ]);

    return this;
  }

  /**
     * Cut paper
     *
     * @param  {string}          value   full or partial. When not specified a full cut will be assumed
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  cut(value) {
    let data = 0x00;

    if (value == 'partial') {
      data = 0x01;
    }

    this._queue([
      0x1b, 0x64, data,
    ]);

    return this;
  }

  /**
     * Add raw printer commands
     *
     * @param  {array}           data   raw bytes to be included
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  raw(data) {
    this._queue(data);

    return this;
  }

  /**
     * Encode all previous commands
     *
     * @return {Uint8Array}         Return the encoded bytes
     *
     */
  encode() {
    let length = 0;

    this._buffer.forEach((item) => {
      if (typeof item === 'number') {
        length++;
      } else {
        length += item.length;
      }
    });

    const result = new Uint8Array(length);

    let index = 0;

    this._buffer.forEach((item) => {
      if (typeof item === 'number') {
        result[index] = item;
        index++;
      } else {
        result.set(item, index);
        index += item.length;
      }
    });

    this._reset();

    return result;
  }
}

module.exports = StarPrntEncoder;
