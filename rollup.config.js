import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';
import gzipPlugin from 'rollup-plugin-gzip';
import buble from '@rollup/plugin-buble';
import typescript from 'rollup-plugin-typescript2';

export default [
    // browser-friendly UMD build
    {
        input: 'src/genetic.ts',
        output: {
            name: 'genetic',
            file: pkg.browser,
            format: 'umd',
        },
        plugins: [
            resolve(), // so Rollup can find `ms`
            commonjs(), // so Rollup can convert `ms` to an ES module
            typescript({
                tsconfigOverride: {
                    compilerOptions: {
                        module: 'ESNext',
                    },
                },
            }),
            buble({
                transforms: { forOf: false },
                objectAssign: 'Object.assign',
                asyncAwait: false,
            }),
            terser(), // uglify
            gzipPlugin(),
        ],
    },
    {
        input: 'src/genetic.ts',
        external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
        plugins: [
            typescript({
                tsconfigOverride: {
                    compilerOptions: {
                        module: 'ESNext',
                        target: 'ES2020',
                    },
                },
            }),
        ],
        output: [
            { file: pkg.main, format: 'cjs' },
            { file: pkg.module, format: 'es' },
        ],
    },
];
