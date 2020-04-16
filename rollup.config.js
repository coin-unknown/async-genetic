import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import pkg from "./package.json";
import gzipPlugin from 'rollup-plugin-gzip'
import buble from 'rollup-plugin-buble';
import typescript from 'rollup-plugin-typescript2';
import nodeResolve from 'rollup-plugin-node-resolve';

export default [
    // browser-friendly UMD build
    {
        input: "src/genetic.ts",
        output: {
            name: "genetic",
            file: pkg.browser,
            format: "umd"
        },
        plugins: [
            nodeResolve(),
            resolve(), // so Rollup can find `ms`
            commonjs(), // so Rollup can convert `ms` to an ES module
            typescript(),
            buble({
                transforms: { forOf: false },
                objectAssign: 'Object.assign',
                asyncAwait: false
            }),
            terser(), // uglify
            gzipPlugin()
        ]
    },
    {
        input: "src/genetic.ts",
        external: [],
        plugins: [
            nodeResolve(),
            commonjs(),
            typescript(),
            buble({
                transforms: { forOf: false },
                objectAssign: 'Object.assign',
                asyncAwait: false
            }),
        ],
        output: [
            { file: pkg.main, format: "cjs" },
            { file: pkg.module, format: "es" }
        ]
    }
];