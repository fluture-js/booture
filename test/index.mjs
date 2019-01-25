import {deepStrictEqual} from 'assert';
import {inspect} from 'util';
import {fork, resolve, debugMode} from 'fluture';
import {acquire, runHook} from 'fluture-hooks';
import {bootstrap} from '..';

debugMode (true);

const eq = a => b => { deepStrictEqual (a, b) };
const fail = x => { throw new Error('Failed with ' + inspect(x)) };

const bootstrap42 = acquire (resolve (42));
const make = (name, needs) => ({name, needs, bootstrap: () => bootstrap42});

fork (fail)
     (eq ({}))
     (runHook (bootstrap ([])) (resolve));

fork (eq (new Error('Cannot bootstrap: unable to provide for: x')))
     (fail)
     (runHook (bootstrap ([make('x', ['y'])])) (resolve));

fork (fail)
     (eq ({x: 42}))
     (runHook (bootstrap ([make('x', [])])) (resolve));

fork (fail)
     (eq ({x: 42, y: 42}))
     (runHook (bootstrap ([make('x', ['y']), make('y', [])])) (resolve));

fork (eq (new Error('Cannot bootstrap: unable to provide for: x; z')))
     (fail)
     (runHook (bootstrap ([make('x', ['y']), make('z', ['y'])])) (resolve));
