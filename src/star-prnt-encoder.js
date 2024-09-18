import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

/**
 * Create a byte stream based on commands for StarPRNT or Star Line printers
 */
class StarPrntEncoder extends ReceiptPrinterEncoder {
  /**
     * Create a new object
     *
     * @param  {object}   options   Object containing configuration options
    */
  constructor(options) {
    options = options || {};
    options.language = 'star-prnt';

    super(options);
  }
}

export default StarPrntEncoder;
