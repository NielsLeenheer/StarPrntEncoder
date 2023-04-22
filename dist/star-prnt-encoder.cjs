'use strict';

var linewrap = require('linewrap');
var canvas = require('canvas');
var Dither = require('canvas-dither');
var Flatten = require('canvas-flatten');
var CodepageEncoder = require('codepage-encoder');

const codepageMappings = {
  star: {
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
    'cp874': 0x14,
    'windows1252': 0x20,
    'windows1250': 0x21,
    'windows1251': 0x22,
  },
};

/**
 * Create a byte stream based on commands for ESC/POS printers
 */
class StarPrntEncoder {
  /**
     * Create a new object
     *
     * @param  {object}   options   Object containing configuration options
    */
  constructor(options) {
    this._reset(options);
  }

  /**
     * Reset the state of the object
     *
     * @param  {object}   options   Object containing configuration options
    */
  _reset(options) {
    this._options = Object.assign({
      width: null,
      embedded: false,
      wordWrap: true,
      codepageMapping: 'star',
      codepageCandidates: [
        'cp437', 'cp858', 'cp860', 'cp861', 'cp863', 'cp865',
        'cp852', 'cp857', 'cp855', 'cp866', 'cp869',
      ],
    }, options);

    this._embedded = this._options.width && this._options.embedded;

    this._buffer = [];
    this._queued = [];
    this._cursor = 0;
    this._codepage = 'ascii';

    this._state = {
      'codepage': 0,
      'align': 'left',
      'bold': false,
      'italic': false,
      'underline': false,
      'invert': false,
      'width': 1,
      'height': 1,
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
    if (this._codepage != 'auto') {
      return CodepageEncoder.encode(value, this._codepage);
    }

    let codepages;

    if (typeof this._options.codepageMapping == 'string') {
      codepages = codepageMappings[this._options.codepageMapping];
    } else {
      codepages = this._options.codepageMapping;
    }

    const fragments = CodepageEncoder.autoEncode(value, this._options.codepageCandidates);

    let length = 0;
    for (let f = 0; f < fragments.length; f++) {
      length += 4 + fragments[f].bytes.byteLength;
    }

    const buffer = new Uint8Array(length);
    let i = 0;

    for (let f = 0; f < fragments.length; f++) {
      buffer.set([0x1b, 0x1d, 0x74, codepages[fragments[f].codepage]], i);
      buffer.set(fragments[f].bytes, i + 4);
      i += 4 + fragments[f].bytes.byteLength;

      this._state.codepage = codepages[fragments[f].codepage];
    }

    return buffer;
  }

  /**
     * Add commands to the queue
     *
     * @param  {array}   value  And array of numbers, arrays, buffers or Uint8Arrays to add to the buffer
     *
    */
  _queue(value) {
    value.forEach((item) => this._queued.push(item));
  }

  /**
   * Flush current queue to the buffer
   *
  */
  _flush() {
    if (this._embedded) {
      let indent = this._options.width - this._cursor;

      if (this._state.align == 'left') {
        this._queued.push((new Array(indent)).fill(0x20));
      }

      if (this._state.align == 'center') {
        const remainder = indent % 2;
        indent = indent >> 1;

        if (indent > 0) {
          this._queued.push((new Array(indent)).fill(0x20));
        }

        if (indent + remainder > 0) {
          this._queued.unshift((new Array(indent + remainder)).fill(0x20));
        }
      }

      if (this._state.align == 'right') {
        this._queued.unshift((new Array(indent)).fill(0x20));
      }
    }

    this._buffer = this._buffer.concat(this._queued);

    this._queued = [];
    this._cursor = 0;
  }

  /**
     * Wrap the text while respecting the position of the cursor
     *
     * @param  {string}   value     String to wrap after the width of the paper has been reached
     * @param  {number}   position  Position on which to force a wrap
     * @return {array}              Array with each line
    */
  _wrap(value, position) {
    if (position || (this._options.wordWrap && this._options.width)) {
      const indent = '-'.repeat(this._cursor);
      const w = linewrap(position || this._options.width, {lineBreak: '\n', whitespace: 'all'});
      const result = w(indent + value).substring(this._cursor).split('\n');

      return result;
    }

    return [value];
  }

  /**
     * Restore styles and codepages after drawing boxes or lines
    */
  _restoreState() {
    this.bold(this._state.bold);
    this.italic(this._state.italic);
    this.underline(this._state.underline);
    this.invert(this._state.invert);

    this._queue([
      0x1b, 0x1d, 0x74, this._state.codepage,
    ]);
  }

  /**
     * Get code page identifier for the specified code page and mapping
     *
     * @param  {string}   codepage  Required code page
     * @return {number}             Identifier for the current printer according to the specified mapping
    */
  _getCodepageIdentifier(codepage) {
    let codepages;

    if (typeof this._options.codepageMapping == 'string') {
      codepages = codepageMappings[this._options.codepageMapping];
    } else {
      codepages = this._options.codepageMapping;
    }

    return codepages[codepage];
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

    this._flush();

    return this;
  }

  /**
     * Change the code page
     *
     * @param  {string}   codepage  The codepage that we set the printer to
     * @return {object}             Return the object, for easy chaining commands
     *
     */
  codepage(codepage) {
    if (codepage === 'auto') {
      this._codepage = codepage;
      return this;
    }

    if (!CodepageEncoder.supports(codepage)) {
      throw new Error('Unknown codepage');
    }

    let codepages;

    if (typeof this._options.codepageMapping == 'string') {
      codepages = codepageMappings[this._options.codepageMapping];
    } else {
      codepages = this._options.codepageMapping;
    }

    if (typeof codepages[codepage] !== 'undefined') {
      this._codepage = codepage;
      this._state.codepage = codepages[codepage];

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
    const lines = this._wrap(value, wrap);

    for (let l = 0; l < lines.length; l++) {
      const bytes = this._encode(lines[l]);

      this._queue([
        bytes,
      ]);

      this._cursor += (lines[l].length * this._state.width);

      if (this._options.width && !this._embedded) {
        this._cursor = this._cursor % this._options.width;
      }

      if (l < lines.length - 1) {
        this.newline();
      }
    }

    return this;
  }

  /**
     * Print a newline
     *
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  newline() {
    this._flush();

    this._queue([
      0x0a, 0x0d,
    ]);

    if (this._embedded) {
      this._restoreState();
    }

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
   * Change width of text
   *
   * @param  {number}          width    The width of the text, 1 - 6
   * @return {object}                   Return the object, for easy chaining commands
   *
   */
  width(width) {
    if (typeof width === 'undefined') {
      width = 1;
    }

    if (typeof width !== 'number') {
      throw new Error('Width must be a number');
    }

    if (width < 1 || width > 6) {
      throw new Error('Width must be between 1 and 6');
    }

    this._state.width = width;

    this._queue([
      0x1b, 0x69, (this._state.height - 1), (this._state.width - 1),
    ]);

    return this;
  }

  /**
   * Change height of text
   *
   * @param  {number}          height  The height of the text, 1 - 6
   * @return {object}                  Return the object, for easy chaining commands
   *
   */
  height(height) {
    if (typeof height === 'undefined') {
      height = 1;
    }

    if (typeof height !== 'number') {
      throw new Error('Height must be a number');
    }

    if (height < 1 || height > 6) {
      throw new Error('Height must be between 1 and 6');
    }

    this._state.height = height;

    this._queue([
      0x1b, 0x69, (this._state.height - 1), (this._state.width - 1),
    ]);

    return this;
  }

  /**
     * Invert text
     *
     * @param  {boolean}          value  true to turn on white text on black, false to turn off
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  invert(value) {
    if (typeof value === 'undefined') {
      value = ! this._state.invert;
    }

    this._state.invert = value;

    this._queue([
      0x1b, value ? 0x34 : 0x35,
    ]);

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
      this._state.align = value;

      if (!this._embedded) {
        this._queue([
          0x1b, 0x1d, 0x61, alignments[value],
        ]);
      }
    } else {
      throw new Error('Unknown alignment');
    }

    return this;
  }

  /**
   * Insert a table
   *
   * @param  {array}           columns  The column definitions
   * @param  {array}           data     Array containing rows. Each row is an array containing cells.
   *                                    Each cell can be a string value, or a callback function.
   *                                    The first parameter of the callback is the encoder object on
   *                                    which the function can call its methods.
   * @return {object}                   Return the object, for easy chaining commands
   *
   */
  table(columns, data) {
    if (this._cursor != 0) {
      this.newline();
    }

    for (let r = 0; r < data.length; r++) {
      const lines = [];
      let maxLines = 0;

      for (let c = 0; c < columns.length; c++) {
        const cell = [];

        if (typeof data[r][c] === 'string') {
          const w = linewrap(columns[c].width, {lineBreak: '\n'});
          const fragments = w(data[r][c]).split('\n');

          for (let f = 0; f < fragments.length; f++) {
            if (columns[c].align == 'right') {
              cell[f] = this._encode(fragments[f].padStart(columns[c].width));
            } else {
              cell[f] = this._encode(fragments[f].padEnd(columns[c].width));
            }
          }
        }

        if (typeof data[r][c] === 'function') {
          const columnEncoder = new StarPrntEncoder(Object.assign({}, this._options, {
            width: columns[c].width,
            embedded: true,
          }));

          columnEncoder._codepage = this._codepage;
          columnEncoder.align(columns[c].align);
          data[r][c](columnEncoder);
          const encoded = columnEncoder.encode();

          let fragment = [];

          for (let e = 0; e < encoded.byteLength; e++) {
            if (e < encoded.byteLength - 1) {
              if (encoded[e] === 0x0a && encoded[e + 1] === 0x0d) {
                cell.push(fragment);
                fragment = [];

                e++;
                continue;
              }
            }

            fragment.push(encoded[e]);
          }

          if (fragment.length) {
            cell.push(fragment);
          }
        }

        maxLines = Math.max(maxLines, cell.length);
        lines[c] = cell;
      }

      for (let c = 0; c < columns.length; c++) {
        if (lines[c].length < maxLines) {
          for (let p = lines[c].length; p < maxLines; p++) {
            let verticalAlign = 'top';
            if (typeof columns[c].verticalAlign !== 'undefined') {
              verticalAlign = columns[c].verticalAlign;
            }

            if (verticalAlign == 'bottom') {
              lines[c].unshift((new Array(columns[c].width)).fill(0x20));
            } else {
              lines[c].push((new Array(columns[c].width)).fill(0x20));
            }
          }
        }
      }

      for (let l = 0; l < maxLines; l++) {
        for (let c = 0; c < columns.length; c++) {
          if (typeof columns[c].marginLeft !== 'undefined') {
            this.raw((new Array(columns[c].marginLeft)).fill(0x20));
          }

          this.raw(lines[c][l]);

          if (typeof columns[c].marginRight !== 'undefined') {
            this.raw((new Array(columns[c].marginRight)).fill(0x20));
          }
        }

        this.newline();
      }
    }

    return this;
  }

  /**
     * Insert a horizontal rule
     *
     * @param  {object}          options  And object with the following properties:
     *                                    - style: The style of the line, either single or double
     *                                    - width: The width of the line, by default the width of the paper
     * @return {object}                   Return the object, for easy chaining commands
     *
     */
  rule(options) {
    options = Object.assign({
      style: 'single',
      width: this._options.width || 10,
    }, options || {});

    this._queue([
      0x1b, 0x1d, 0x74, this._getCodepageIdentifier('cp437'),
      (new Array(options.width)).fill(options.style === 'double' ? 0xcd : 0xc4),
    ]);

    this._queue([
      0x1b, 0x1d, 0x74, this._state.codepage,
    ]);

    this.newline();

    return this;
  }

  /**
     * Insert a box
     *
     * @param  {object}           options   And object with the following properties:
     *                                      - style: The style of the border, either single or double
     *                                      - width: The width of the box, by default the width of the paper
     *                                      - marginLeft: Space between the left border and the left edge
     *                                      - marginRight: Space between the right border and the right edge
     *                                      - paddingLeft: Space between the contents and the left border of the box
     *                                      - paddingRight: Space between the contents and the right border of the box
     * @param  {string|function}  contents  A string value, or a callback function.
     *                                      The first parameter of the callback is the encoder object on
     *                                      which the function can call its methods.
     * @return {object}                     Return the object, for easy chaining commands
     *
     */
  box(options, contents) {
    options = Object.assign({
      style: 'single',
      width: this._options.width || 30,
      marginLeft: 0,
      marginRight: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, options || {});

    let elements;

    if (options.style == 'double') {
      elements = [0xc9, 0xbb, 0xc8, 0xbc, 0xcd, 0xba]; // ╔╗╚╝═║
    } else {
      elements = [0xda, 0xbf, 0xc0, 0xd9, 0xc4, 0xb3]; // ┌┐└┘─│
    }

    if (this._cursor != 0) {
      this.newline();
    }

    this._restoreState();

    this._queue([
      0x1b, 0x1d, 0x74, this._getCodepageIdentifier('cp437'),
    ]);

    this._queue([
      new Array(options.marginLeft).fill(0x20),
      elements[0],
      new Array(options.width - 2).fill(elements[4]),
      elements[1],
      new Array(options.marginRight).fill(0x20),
    ]);

    this.newline();

    const cell = [];

    if (typeof contents === 'string') {
      const w = linewrap(options.width - 2 - options.paddingLeft - options.paddingRight, {lineBreak: '\n'});
      const fragments = w(contents).split('\n');

      for (let f = 0; f < fragments.length; f++) {
        if (options.align == 'right') {
          cell[f] = this._encode(fragments[f].padStart(options.width - 2 - options.paddingLeft - options.paddingRight));
        } else {
          cell[f] = this._encode(fragments[f].padEnd(options.width - 2 - options.paddingLeft - options.paddingRight));
        }
      }
    }

    if (typeof contents === 'function') {
      const columnEncoder = new StarPrntEncoder(Object.assign({}, this._options, {
        width: options.width - 2 - options.paddingLeft - options.paddingRight,
        embedded: true,
      }));

      columnEncoder._codepage = this._codepage;
      columnEncoder.align(options.align);
      contents(columnEncoder);
      const encoded = columnEncoder.encode();

      let fragment = [];

      for (let e = 0; e < encoded.byteLength; e++) {
        if (e < encoded.byteLength - 1) {
          if (encoded[e] === 0x0a && encoded[e + 1] === 0x0d) {
            cell.push(fragment);
            fragment = [];

            e++;
            continue;
          }
        }

        fragment.push(encoded[e]);
      }

      if (fragment.length) {
        cell.push(fragment);
      }
    }

    for (let c = 0; c < cell.length; c++) {
      this._queue([
        new Array(options.marginLeft).fill(0x20),
        elements[5],
        new Array(options.paddingLeft).fill(0x20),
      ]);

      this._queue([
        cell[c],
      ]);

      this._restoreState();

      this._queue([
        0x1b, 0x1d, 0x74, this._getCodepageIdentifier('cp437'),
      ]);

      this._queue([
        new Array(options.paddingRight).fill(0x20),
        elements[5],
        new Array(options.marginRight).fill(0x20),
      ]);

      this.newline();
    }

    this._queue([
      new Array(options.marginLeft).fill(0x20),
      elements[2],
      new Array(options.width - 2).fill(elements[4]),
      elements[3],
      new Array(options.marginRight).fill(0x20),
    ]);

    this._restoreState();

    this.newline();

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
    if (this._embedded) {
      throw new Error('Barcodes are not supported in table cells or boxes');
    }

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
      const bytes = CodepageEncoder.encode(value, 'ascii');

      this._queue([
        0x1b, 0x62,
        symbologies[symbology], 0x01, 0x03, height,
        bytes, 0x1e,
      ]);
    } else {
      throw new Error('Symbology not supported by printer');
    }

    this._flush();

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
    if (this._embedded) {
      throw new Error('QR codes are not supported in table cells or boxes');
    }

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

    const bytes = CodepageEncoder.encode(value, 'iso88591');
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

    this._flush();

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
    if (this._embedded) {
      throw new Error('Images are not supported in table cells or boxes');
    }

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

    const canvas$1 = canvas.createCanvas(width, height);
    const context = canvas$1.getContext('2d');
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

    this._flush();

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
    if (this._embedded) {
      throw new Error('Cut is not supported in table cells or boxes');
    }

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
     * Pulse
     *
     * @param  {number}          device  0 or 1 for on which pin the device is connected, default of 0
     * @param  {number}          on      Time the pulse is on in milliseconds, default of 200
     * @param  {number}          off     Time the pulse is off in milliseconds, default of 200
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  pulse(device, on, off) {
    if (this._embedded) {
      throw new Error('Pulse is not supported in table cells or boxes');
    }

    if (typeof device === 'undefined') {
      device = 0;
    }

    if (typeof on === 'undefined') {
      on = 200;
    }

    if (typeof off === 'undefined') {
      off = 200;
    }

    on = Math.min(127, Math.round(on / 10));
    off = Math.min(127, Math.round(off / 10));

    this._queue([
      0x1b, 0x07, on & 0xff, off & 0xff,
      device ? 0x1a : 0x07,
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
    this._flush();

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
