import StarPrntEncoder from '../src/star-prnt-encoder.js';
import { assert, expect } from 'chai';


describe('StarPrntEncoder', function() {
    let encoder = new StarPrntEncoder();

    describe('StarPrntEncoder()', function () {
        it('should be .language == star-prnt', function () {
            assert.deepEqual('star-prnt', encoder.language);
        });
    });
});
