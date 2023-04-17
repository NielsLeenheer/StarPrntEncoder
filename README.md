# star-prnt-encoder

Create a set of commands that can be send to any receipt printer that supports StarPRNT

## Usage

First, install the package using npm:

    npm install star-prnt-encoder --save

Then, require the package and use it like so:

    let StarPrntEncoder = require('star-prnt-encoder');

    let encoder = new StarPrntEncoder();

    let result = encoder
        .initialize()
        .text('The quick brown fox jumps over the lazy dog')
        .newline()
        .qrcode('https://nielsleenheer.com')
        .encode();

All commands can be chained, except for `encode()` which will return the result as an Uint8Array which contains all the bytes that need to be send to the printer.

You can reuse the instantiated `StarPrntEncoder` class to generate multiple commands or sets of commands for the same printer. It will remember settings like code page, so you don't have to specify that on subsequent use. That does rely on that previous commands were actually send to the printer. 

The following commands are available:

### Initialize

Properly initialize the printer, which means text mode is enabled and settings like code page are set to default.

    let result = encoder
        .initialize()
        .encode()

### Codepage

Set the code page of the printer. Receipt printers don't support UTF-8 or any other unicode encoding, instead the rely on legacy code pages. 

If you specify the code page, it will send a command to the printer to enable that particular code page and from then on it will automatically encode all text string to that code page. 

If you don't specify a code page, it will assume you want to print only ASCII characters and strip out any others.

    let result = encoder
        .codepage('windows1251')
        .text('Iñtërnâtiônàlizætiøn')
        .codepage('cp874')
        .text('กำลังทดสอบ')
        .encode()

The following code pages are supported: 
cp437, cp858, cp852, cp860, cp861, cp863, cp865, cp866, cp855, cp857, cp862, cp864, cp737, cp869, cp874, windows1252, windows1250, windows1251.

### Text

Print a string of text. If the text is longer than the line width of the printer, it will automatially wrap to the next line when it reaches the maximum width. That means it could wrap right in the middle of a word.

    let result = encoder
        .text('The quick brown fox jumps over the lazy dog')
        .encode()

An optional parameter turns on word wrapping. To enable this, specify the maximum length of the line.

    let result = encoder
        .text('The quick brown fox jumps over the lazy dog', 20)
        .encode()

### Newline

Move to the beginning of the next line.

    let result = encoder
        .newline()
        .encode()

### Line

Print a line of text. This is similar to the `text()` command, except it will automatically add a `newline()` command.

    let result = encoder
        .line('The is the first line')
        .line('And this is the second')
        .encode()

This would be equal to:

    let result = encoder
        .text('The is the first line')
        .newline()
        .text('And this is the second')
        .newline()
        .encode()

An optional parameter turns on word wrapping. To enable this, specify the maximum length of the line.

    let result = encoder
        .line('The quick brown fox jumps over the lazy dog', 20)
        .encode()

### Underline

Change the text style to underline. 

    let result = encoder
        .text('This is ')
        .underline()
        .text('underlined')
        .underline()
        .encode()

It will try to remember the current state of the text style. But you can also provide and additional parameter to force the text style to turn on and off.

    let result = encoder
        .text('This is ')
        .underline(true)
        .text('bold')
        .underline(false)
        .encode()

### Bold

Change the text style to bold. 

    let result = encoder
        .text('This is ')
        .bold()
        .text('bold')
        .bold()
        .encode()

It will try to remember the current state of the text style. But you can also provide and additional parameter to force the text style to turn on and off.

    let result = encoder
        .text('This is ')
        .bold(true)
        .text('bold')
        .bold(false)
        .encode()

### Align

Change the alignment of the text. You can specify the alignment using a parameter which can be either "left", "center" or "right".

    let result = encoder
        .align('right')
        .line('This line is aligned to the right')
        .align('center')
        .line('This line is centered')
        .align('left')
        .line('This line is aligned to the left')
        .encode()

### Size

Change the text size. You can specify the size using a parameter which can be either "small" or "normal".

    let result = encoder
        .size('small')
        .line('A line of small text)
        .size('normal')
        .line('A line of normal text)
        .encode()

### Barcode

Print a barcode of a certain symbology. The first parameter is the value of the barcode as a string, the second is the symbology and finally the height of the barcode.

The following symbologies can be used: 'upce', 'upca', 'ean13', 'ean8', 'code39', 'itf', 'code93', 'code128', 'nw-7', 'gs1-128', 'gs1-databar-omni', 'gs1-databar-truncated', 'gs1-databar-limited', 'gs1-databar-expanded'.

_Just because the symbology is suppored by this library does not mean that the printer will actually support it. If the symbology is not supported, the barcode will simply not be printed, or the raw data will be printed instead, depending on the model and manufacturer of the printer._

In general the printer will automatically calculate the checksum if one is not provided. If one is provided in the data, it will not check the checksum. If you provide the checksum yourself and it is not correctly calculated, the behaviour is not defined. It may calculate the correct checksum use that instead or print an invalid barcode. 

For example with the checksum provided in the data:

    let result = encoder
        .barcode('3130630574613', 'ean13', 60)
        .encode()

Or without a checksum:

    let result = encoder
        .barcode('313063057461', 'ean13', 60)
        .encode()

Both examples above should result in the same barcode being printed.

Furthermore, depending on the symbology the data must be handled differently:

| Symbology | Length | Characters |
|-|-|-|
| upca | 11 - 12 | 0 - 9 |
| ean8 | 7 - 8 | 0 - 9 |
| ean13 | 12 - 13 | 0 - 9 |
| code39 | >= 1 | 0 - 9, A - Z, space, or $ % * + - . / |
| itf | >= 2 (even) | 0 - 9 |
| codabar | >= 2 | 0 - 9, A - D, a - d, or $ + − . / : |
| code93 | 1 - 255 | ASCII character (0 - 127) |
| code128 | 1 - 253 | ASCII character (32 - 127) |

The Code 128 symbology specifies three different code sets which contain different characters. For example: CODE A contains ASCII control characters, special characters, digits and uppercase letters. CODE B contains special characters, digits, uppercase letters and lowercase letters. CODE C prints 2 digits numbers that correspond to the ASCII value of the letter.  

By default Code 128 uses CODE B. It is possible to use a different code set, by using the code set selector character { followed by the uppercase letter of the character set.

For example with the default CODE B set: 

    let result = encoder
        .barcode('CODE128 test', 'code128', 60)
        .encode()

Is equivalent to manually selecting CODE B:

    let result = encoder
        .barcode('{B' + 'CODE128 test', 'code128', 60)
        .encode()

And Code C only supports numbers, but you must encode it as a string:

    let result = encoder
        .barcode('{C' + '2Uc#', 'code128', 60)
        .encode()

If you look up the value of the characters in an ASCII table, you will see that 2 = 50, U = 85, c = 99 and # = 35.

The printed barcode will be 50859935.

All of the other symbologies require even more complicated encoding specified in the Espon ESC/POS printer language specification. To use these other symbologies you need to encode these barcodes yourself.



### Qrcode

Print a QR code. The first parameter is the data of the QR code.

    let result = encoder
        .qrcode('https://nielsleenheer.com')
        .encode()

The qrcode function accepts the following additional parameters:

- *model* - a number that can be 1 for Model 1 and 2 for Model 2
- *size* - a number that can be between 1 and 8 for determining the size of the QR code
- *errorlevel* - a string that can be either 'l', 'm', 'q' or 'h'.

For example:

    let result = encoder
        .qrcode('https://nielsleenheer.com', 1, 8, 'h')
        .encode()


### Image

Print an image. The image is automatically converted to black and white and can optionally be dithered using different algorithms.

The first parameter is the image itself. When running in the browser it can be any element that can be drawn onto a canvas, like an img, svg, canvas and video elements. When on Node it can be a Canvas provided by the `canvas` package. 

The second parameter is the width of the image on the paper receipt in pixels. It must be a multiple of 8.

The third parameter is the height of the image on the paper receipt in pixels. It must be a multiple of 8.

The fourth parameter is the dithering algorithm that is used to turn colour and grayscale images into black and white. The follow algorithms are supported: threshold, bayer, floydsteinberg, atkinson. If not supplied, it will default to a simple threshold.

The fifth paramter is the threshold that will be used by the threshold and bayer dithering algorithm. It is ignored by the other algorithms. It is set to a default of 128.

    let img = new Image();
    img.src = 'https://...';
    
    img.onload = function() {
        let result = encoder
            .image(img, 320, 320, 'atkinson')
            .encode()
    }

### Cut

Cut the paper. Optionally a parameter can be specified which can be either be "partial" or "full". If not specified, a full cut will be used. 

    let result = encoder
        .cut('partial')
        .encode()

Note: Not all printer models support cutting paper. And even if they do, they might not support both types of cuts.

### Raw

Add raw printer commands, in case you want to send a command that this library does not support natively. For example the following command is to turn of Hanzi character mode.

    let result = encoder
        .raw([ 0x1c, 0x2e ])
        .encode()
        

## License

MIT
