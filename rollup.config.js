import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default [

	// Browser-friendly UMD build
	{
		input: 'src/star-prnt-encoder.js',
		output: {
			name: 'StarPrintEncoder',
			file: 'dist/star-prnt-encoder.umd.js',
			format: 'umd'
		},
		plugins: [
			resolve({ browser: true }), 
			commonjs(),
            terser()
		]
	},

	// Browser-friendly ES module build
	{
		input: 'src/star-prnt-encoder.js',
		output: { 
			file: 'dist/star-prnt-encoder.esm.js', 
			format: 'es' 
		},
		plugins: [
			resolve({ browser: true }), 
			commonjs(),
            terser()
		]
	},

    // CommonJS (for Node) and ES module (for bundlers) build
    {
		input: 'src/star-prnt-encoder.js',
		external: ['canvas', 'canvas-dither', 'canvas-flatten', 'codepage-encoder', 'linewrap'],
		output: [
			{ file: 'dist/star-prnt-encoder.cjs', format: 'cjs' },
			{ file: 'dist/star-prnt-encoder.mjs', format: 'es' }
		]
	}
];
