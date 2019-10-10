export default {
  input: 'index.js',
  external: ['fluture/index.js', 'fluture-hooks/index.js'],
  output: {
    format: 'umd',
    name: 'booture',
    file: 'index.cjs',
    interop: false,
    paths: {
      'fluture/index.js': 'fluture',
      'fluture-hooks/index.js': 'fluture-hooks',
    },
    globals: {
      'fluture/index.js': 'Fluture',
      'fluture-hooks/index.js': 'flutureHooks'
    }
  }
};
