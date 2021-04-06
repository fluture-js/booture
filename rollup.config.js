import pkg from './package.json';

const dependencyNames = Array.prototype.concat.call (
  Object.keys (pkg.dependencies),
  Object.keys (pkg.peerDependencies),
  ['fluture/index.js', 'fluture-hooks/index.js']
);

export default {
  input: 'index.js',
  external: dependencyNames,
  output: {
    format: 'umd',
    name: 'booture',
    file: 'dist/umd.js',
    interop: false,
    exports: 'named',
    paths: {
      'fluture/index.js': 'fluture',
      'fluture-hooks/index.js': 'fluture-hooks',
    },
    globals: {
      'fluture/index.js': 'Fluture',
      'fluture-hooks/index.js': 'flutureHooks',
    },
  },
};
