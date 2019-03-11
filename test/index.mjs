import {deepStrictEqual, throws} from 'assert';
import {inspect} from 'util';
import {fork, resolve, debugMode} from 'fluture';
import {acquire, runHook} from 'fluture-hooks';
import {bootstrap} from '..';

debugMode (true);

const eq = a => b => { deepStrictEqual (a, b) };
const fail = x => { throw new Error('Failed with ' + inspect(x)) };

const bootstrap42 = acquire (resolve (42));
const make = (name, needs) => ({name, needs, bootstrap: () => bootstrap42});

const flawed = {
  '  - [x] has 2 providers:\n    - One depending on [y]; and\n    - One depending on [z]': [
    make('x', ['y']),
    make('x', ['z']),
  ],
  '  - [x] needs [y], which has no provider': [
    make('x', ['y']),
  ],
  '  - [x] circles around via [x -> x]': [
    make('x', ['x']),
  ],
  '  - [x] circles around via [x -> y -> x]': [
    make('x', ['y']),
    make('y', ['x']),
  ],
  '  - [x] circles around via [x -> y -> x]\n  - [y] needs [z], which has no provider': [
    make('x', ['y']),
    make('y', ['x', 'z']),
  ]
};

Object.entries(flawed).forEach(([message, bootstrappers]) => {
  throws (() => bootstrap (bootstrappers)
         , new TypeError(`Flawed dependency graph:\n${message}`));
});

fork (fail)
     (eq ({}))
     (runHook (bootstrap ([])) (resolve));

fork (fail)
     (eq ({x: 42}))
     (runHook (bootstrap ([make('x', [])])) (resolve));

fork (fail)
     (eq ({x: 42, y: 42}))
     (runHook (bootstrap ([make('x', ['y']), make('y', [])])) (resolve));
