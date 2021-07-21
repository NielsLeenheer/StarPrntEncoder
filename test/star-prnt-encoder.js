const StarPrntEncoder = require ('../src/star-prnt-encoder');
const { createCanvas } = require('canvas');

const chai = require('chai');  
const assert = chai.assert;
const expect = chai.expect;
const should = chai.should();


describe('StarPrntEncoder', function() {
    let encoder = new StarPrntEncoder();

    describe('text(hello)', function () {
        let result = encoder.text('hello').encode();
        
        it('should be [ 104, 101, 108, 108, 111 ]', function () {
            assert.deepEqual(new Uint8Array([ 104, 101, 108, 108, 111 ]), result);
        });
    });

    describe('text(hello).newline()', function () {
        let result = encoder.text('hello').newline().encode();
        
        it('should be [ 104, 101, 108, 108, 111, 10, 13 ]', function () {
            assert.deepEqual(new Uint8Array([ 104, 101, 108, 108, 111, 10, 13 ]), result);
        });
    });

    describe('line(hello)', function () {
        let result = encoder.line('hello').encode();
        
        it('should be [ 104, 101, 108, 108, 111, 10, 13 ]', function () {
            assert.deepEqual(new Uint8Array([ 104, 101, 108, 108, 111, 10, 13 ]), result);
        });
    });

    describe('text(héllo) - é -> ?', function () {
        let result = encoder.text('héllo').encode();
        
        it('should be [ 104, 63, 108, 108, 111 ]', function () {
            assert.deepEqual(new Uint8Array([ 104, 63, 108, 108, 111 ]), result);
        });
    });

    describe('codepage(cp437).text(héllo) - é -> 130', function () {
        let result = encoder.codepage('cp437').text('héllo').encode();
        
        it('should be [27, 29, 116, 1, 104, 130, 108, 108, 111]', function () {
            assert.deepEqual(new Uint8Array([27, 29, 116, 1, 104, 130, 108, 108, 111]), result);
        });
    });

    describe('codepage(cp874).text(กำลังทดสอบ) - thai', function () {
        let result = encoder.codepage('cp874').text('กำลังทดสอบ').encode();
        
        it('should be [27, 29, 116, 20, 161, 211, 197, 209, 167, 183, 180, 202, 205, 186]', function () {
            assert.deepEqual(new Uint8Array([27, 29, 116, 20, 161, 211, 197, 209, 167, 183, 180, 202, 205, 186]), result);
        });
    });

    describe('codepage(win1252).text(héllo) - é -> 233', function () {
        let result = encoder.codepage('win1252').text('héllo').encode();
        
        it('should be [27, 29, 116, 32, 104, 233, 108, 108, 111]', function () {
            assert.deepEqual(new Uint8Array([27, 29, 116, 32, 104, 233, 108, 108, 111]), result);
        });
    });

    describe('codepage(utf8).text(héllo)', function () {
        it('should throw an "Codepage not supported by printer" error', function () {
            expect(function(){
                let result = encoder.codepage('utf8').text('héllo').encode();
            }).to.throw('Codepage not supported by printer');
        });
    });

    describe('codepage(unknown).text(héllo)', function () {
        it('should throw an "Unknown codepage" error', function () {
            expect(function(){
                let result = encoder.codepage('unknown').text('héllo').encode();
            }).to.throw('Unknown codepage');
        });
    });

    describe('bold(true).text(hello).bold(false)', function () {
        let result = encoder.bold(true).text('hello').bold(false).encode();
        
        it('should be [ 27, 69, ..., 27, 70 ]', function () {
            assert.deepEqual(new Uint8Array([ 27, 69, 104, 101, 108, 108, 111, 27, 70 ]), result);
        });
    });

    describe('bold().text(hello).bold()', function () {
        let result = encoder.bold().text('hello').bold().encode();
        
        it('should be [ 27, 69, ..., 27, 70 ]', function () {
            assert.deepEqual(new Uint8Array([ 27, 69, 104, 101, 108, 108, 111, 27, 70 ]), result);
        });
    });

    describe('italic().text(hello).italic()', function () {
        let result = encoder.italic().text('hello').italic().encode();
        
        it('should be [ 104, 101, 108, 108, 111 ]', function () {
            assert.deepEqual(new Uint8Array([ 104, 101, 108, 108, 111 ]), result);
        });
    });

    describe('underline(true).text(hello).underline(false)', function () {
        let result = encoder.underline(true).text('hello').underline(false).encode();
        
        it('should be [ 27, 45, 1, ..., 27, 45, 0 ]', function () {
            assert.deepEqual(new Uint8Array([ 27, 45, 1, 104, 101, 108, 108, 111, 27, 45, 0 ]), result);
        });
    });

    describe('underline().text(hello).underline()', function () {
        let result = encoder.underline().text('hello').underline().encode();
        
        it('should be [ 27, 45, 1, ..., 27, 45, 0 ]', function () {
            assert.deepEqual(new Uint8Array([ 27, 45, 1, 104, 101, 108, 108, 111, 27, 45, 0 ]), result);
        });
    });

    describe('align(left).line(hello)', function () {
        let result = encoder.align('left').line('hello').encode();
        
        it('should be [ 27, 29, 97, 0, ..., 10, 13 ]', function () {
            assert.deepEqual(new Uint8Array([27, 29, 97, 0, 104, 101, 108, 108, 111, 10, 13]), result);
        });
    });

    describe('align(center).line(hello)', function () {
        let result = encoder.align('center').line('hello').encode();
        
        it('should be [ 27, 29, 97, 1, ..., 10, 13 ]', function () {
            assert.deepEqual(new Uint8Array([27, 29, 97, 1, 104, 101, 108, 108, 111, 10, 13]), result);
        });
    });

    describe('align(right).line(hello)', function () {
        let result = encoder.align('right').line('hello').encode();
        
        it('should be [ 27, 29, 97, 2, ..., 10, 13 ]', function () {
            assert.deepEqual(new Uint8Array([27, 29, 97, 2, 104, 101, 108, 108, 111, 10, 13]), result);
        });
    });

    describe('qrcode(https://nielsleenheer.com)', function () {
        let result = encoder.qrcode('https://nielsleenheer.com').encode();
        
        it('should be [ 10, 27, 29, 121, 83, 48, 2, 27, 29, 121, 83, 50, 6, ... ]', function () {
            assert.deepEqual(new Uint8Array([10, 27, 29, 121, 83, 48, 2, 27, 29, 121, 83, 50, 6, 27, 29, 121, 83, 49, 1, 27, 29, 121, 68, 49, 0, 25, 0, 104, 116, 116, 112, 115, 58, 47, 47, 110, 105, 101, 108, 115, 108, 101, 101, 110, 104, 101, 101, 114, 46, 99, 111, 109, 27, 29, 121, 80]), result);
        });
    });

    describe('qrcode(https://nielsleenheer.com, 1, 8, h)', function () {
        let result = encoder.qrcode('https://nielsleenheer.com', 1, 8, 'h').encode();
        
        it('should be [ 10, 27, 29, 121, 83, 48, 1, 27, 29, 121, 83, 50, 8, ... ]', function () {
            assert.deepEqual(new Uint8Array([10, 27, 29, 121, 83, 48, 1, 27, 29, 121, 83, 50, 8, 27, 29, 121, 83, 49, 3, 27, 29, 121, 68, 49, 0, 25, 0, 104, 116, 116, 112, 115, 58, 47, 47, 110, 105, 101, 108, 115, 108, 101, 101, 110, 104, 101, 101, 114, 46, 99, 111, 109, 27, 29, 121, 80]), result);
        });
    });

    describe('barcode(3130630574613, ean13, 60)', function () {
        let result = encoder.barcode('3130630574613', 'ean13', 60).encode();
        
        it('should be [27, 98, 3, 1, 3, 60, 51, 49, 51, 48, 54, 51, 48, 53, 55, 52, 54, 49, 51, 30]', function () {
            assert.deepEqual(new Uint8Array([27, 98, 3, 1, 3, 60, 51, 49, 51, 48, 54, 51, 48, 53, 55, 52, 54, 49, 51, 30]), result);
        });
    });

    describe('barcode(CODE128, code128, 60)', function () {
        let result = encoder.barcode('CODE128', 'code128', 60).encode();
        
        it('should be [27, 98, 6, 1, 3, 60, 67, 79, 68, 69, 49, 50, 56, 30]', function () {
            assert.deepEqual(new Uint8Array([27, 98, 6, 1, 3, 60, 67, 79, 68, 69, 49, 50, 56, 30]), result);
        });
    });

    describe('barcode({ACODE128, code128, 60)', function () {
        let result = encoder.barcode('{ACODE128', 'code128', 60).encode();
        
        it('should be [27, 98, 6, 1, 3, 60, 123, 65, 67, 79, 68, 69, 49, 50, 56, 30]', function () {
            assert.deepEqual(new Uint8Array([27, 98, 6, 1, 3, 60, 123, 65, 67, 79, 68, 69, 49, 50, 56, 30]), result);
        });
    });

    describe('barcode({BCODE128, code128, 60)', function () {
        let result = encoder.barcode('{BCODE128', 'code128', 60).encode();
        
        it('should be [27, 98, 6, 1, 3, 60, 123, 66, 67, 79, 68, 69, 49, 50, 56, 30]', function () {
            assert.deepEqual(new Uint8Array([27, 98, 6, 1, 3, 60, 123, 66, 67, 79, 68, 69, 49, 50, 56, 30]), result);
        });
    });

    describe('barcode({C2Uc#, code128, 60)', function () {
        let result = encoder.barcode('{C2Uc#', 'code128', 60).encode();
        
        it('should be [27, 98, 6, 1, 3, 60, 123, 67, 50, 85, 99, 35, 30]', function () {
            assert.deepEqual(new Uint8Array([27, 98, 6, 1, 3, 60, 123, 67, 50, 85, 99, 35, 30]), result);
        });
    });

    describe('image(canvas, 8, 24) - with a black pixel at 0,0', function () {
        let canvas = createCanvas(8, 24);
        let context = canvas.getContext('2d');
        context.fillStyle = 'rgba(0, 0, 0, 1)';
        context.fillRect( 0, 0, 1, 1 );

        let result = encoder.image(canvas, 8, 24).encode();
                
        it('should be [27, 48, 27, 88, 8, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 13, 27, 122, 1]', function () {
            assert.deepEqual(new Uint8Array([27, 48, 27, 88, 8, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 13, 27, 122, 1]), result);
        });
    });

    describe('cut()', function () {
        let result = encoder.cut().encode();
        
        it('should be [ 27, 100, 00 ]', function () {
            assert.deepEqual(new Uint8Array([ 27, 100, 00 ]), result);
        });
    });

    describe('cut(full)', function () {
        let result = encoder.cut('full').encode();
        
        it('should be [ 27, 100, 00 ]', function () {
            assert.deepEqual(new Uint8Array([ 27, 100, 00 ]), result);
        });
    });

    describe('cut(partial)', function () {
        let result = encoder.cut('partial').encode();
        
        it('should be [ 27, 100, 01 ]', function () {
            assert.deepEqual(new Uint8Array([ 27, 100, 01 ]), result);
        });
    });

    describe('raw([ 0x1c, 0x2e ])', function () {
        let result = encoder.raw([ 0x1c, 0x2e ]).encode();
        
        it('should be [ 28, 46 ]', function () {
            assert.deepEqual(new Uint8Array([ 28, 46 ]), result);
        });
    });
});
