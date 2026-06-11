import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/main.ts',
  output: {
    file: 'main.js',
    format: 'cjs',
    sourcemap: true,
  },
  external: ['obsidian'],
  plugins: [
    resolve({ browser: false, preferBuiltins: true }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      outDir: 'dist',
      // Important: do not emit declarations
      declaration: false,
    }),
  ],
};

