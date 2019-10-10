//. # Booture
//.
//. Application bootstrapping on top of [Fluture Hooks][].
//.
//. Booture uses Hooks (as you might expect) to ensure that whatever happens,
//. once a service is acquired, it will always be disposed. Furthermore,
//. acquisition and disposal of services happens at optimal parallelism.
//.
//. Booture exposes a single function: [`bootstrap`](#bootstrap), which in
//. combination with [Fluture][] and [Fluture Hooks][], provides an ideal
//. platform for control over your application lifecycle.
//.
//. ## Usage Example
//.
//. ```console
//. npm install fluture booture fluture-hooks
//. ```
//.
//. The example below defines four "services": `config`, `postgres`, `redis`,
//. and `app`. The App depends on Redis and Postgres having been initialized,
//. which in turn depend on the Config service.
//.
//. The consumption of these services happens in the form of binding the App to
//. a port, and waiting for SIGINT to complete the consumption.
//.
//. ```js
//. import {Future, node, fork, attempt} from 'fluture';
//. import {bootstrap} from 'booture';
//. import {hook, acquire, runHook} from 'fluture-hooks';
//.
//. const acquireConfig = (
//.   attempt (() => ({
//.     redis: {url: process.env.REDIS_URL},
//.     postgres: {url: process.env.POSTGRES_URL},
//.   }))
//. );
//.
//. const acquirePostgres = config => (
//.   node (done => require ('imaginary-postgres') .connect (config, done))
//. );
//.
//. const acquireRedis = config => (
//.   node (done => require ('imaginary-redis') .connect (config, done))
//. );
//.
//. const closeConnection = connection => (
//.   node (done => connection.end (done))
//. );
//.
//. const acquireApp = (redis, postgres) => (
//.   attempt (() => require ('./imaginary-app').create (redis, postgres))
//. );
//.
//. const bootstrapConfig = {
//.   name: 'config',
//.   needs: [],
//.   bootstrap: () => acquire (acquireConfig),
//. };
//.
//. const bootstrapPostgres = {
//.   name: 'postgres',
//.   needs: ['config'],
//.   bootstrap: ({config}) => hook (acquirePostgres (config.postgres)) (closeConnection),
//. };
//.
//. const bootstrapRedis = {
//.   name: 'redis',
//.   needs: ['config'],
//.   bootstrap: ({config}) => hook (acquireRedis (config.redis)) (closeConnection),
//. };
//.
//. const bootstrapApp = {
//.   name: 'app',
//.   needs: ['redis, postgres'],
//.   bootstrap: ({redis, postgres}) => acquire (acquireApp (redis, postgres)),
//. };
//.
//. const servicesHook = bootstrap ([ bootstrapConfig,
//.                                   bootstrapPostgres,
//.                                   bootstrapRedis,
//.                                   bootstrapApp ]);
//.
//. const withServices = runHook (servicesHook);
//.
//. const program = withServices (({app}) => Future ((rej, res) => {
//.   const conn = app.listen (3000);
//.   conn.once ('error', rej);
//.   process.once ('SIGINT', res);
//. }));
//.
//. fork (console.error) (console.log) (program);
//. ```
//.
//. Some things to note about the example above, and general usage of Booture:
//.
//. 1. `servicesHook` is a `Hook`, so before running it, it can be composed
//.    with other hooks using `map`, `ap`, and `chain`, and even used in the
//.    definition of other bootstrappers.
//. 2. `program` is a `Future`, so nothing happens until it's forked. Before
//.    forking it, it can be composed with other Futures using `map`, `ap`,
//.    `bimap`, and `chain`, or any of the other functions provided by Fluture.

import {map, chain} from 'fluture/index.js';
import {hookAll, Hook} from 'fluture-hooks/index.js';

// hasProp :: Object ~> String -> Boolean
const hasProp = Object.prototype.hasOwnProperty;

const check = bootstrappers => {
  const indexed = bootstrappers.reduce((acc, boot) => Object.assign({}, acc, {
    [boot.name]: (acc[boot.name] || []).concat([boot])
  }), {});

  const doubles = Object.values(indexed).filter(({length}) => length > 1);

  if (doubles.length > 0) {
    throw new TypeError(`Flawed dependency graph:\n${
      doubles.map(boots => `  - [${boots[0].name}] has ${boots.length} providers:\n${
        boots.map(boot => `    - One depending on [${boot.needs.join('; ')}]`).join('; and\n')
      }`).join('\n')
    }`);
  }

  const validateTree = ({path, checked, flaws}, {name, needs}) => {
    if (checked.includes(name)) {
      return {path, flaws, checked};
    }

    if (path.includes(name)) {
      return {path, checked: checked.concat([name]), flaws: flaws.concat([
        `[${name}] circles around via [${path.slice(path.indexOf(name)).join(' -> ')} -> ${name}]`
      ])};
    }

    const subs = needs.reduce((acc, need) => (
      indexed[need] ?
      validateTree(acc, indexed[need][0]) :
      {path: acc.path, checked: acc.checked.concat([need]), flaws: acc.flaws.concat([
        `[${name}] needs [${need}], which has no provider`
      ])}
    ), {path: path.concat([name]), checked, flaws});

    return {path, checked: subs.checked.concat([name]), flaws: subs.flaws};
  }

  const {flaws} = bootstrappers.reduce(validateTree, {path: [], flaws: [], checked: []});

  if (flaws.length > 0) {
    throw new TypeError(`Flawed dependency graph:\n${
      flaws.map(flaw => `  - ${flaw}`).join('\n')
    }`);
  }
}

const callBootstrappers = (bootstrappers, resources) => (
  map (xs => xs.reduce ((acc, {resource, name}) => ({...acc, [name]: resource}), resources))
      (hookAll (bootstrappers.map (
        ({name, bootstrap}) => map (resource => ({resource, name})) (bootstrap (resources))
      )))
);

const complete = (bootstrappers, hookResources) => (
  bootstrappers.length === 0 ? hookResources : chain (resources => {
    const pred = ({needs}) => needs.every (need => hasProp.call (resources, need));
    const layer = bootstrappers.filter (pred);
    const remainder = bootstrappers.filter (x => ! pred (x));
    return complete (remainder, callBootstrappers (layer, resources));
  }) (hookResources)
);

//. ## API
//.
//. ### Types
//.
//. ```hs
//. type Name = String
//. type Services a = Dict Name a
//. data Bootstrapper a b = Bootstrapper {
//.   name :: Name,
//.   needs :: Array Name,
//.   bootstrap :: Services b -> Hook (Future c a) b
//. }
//. ```
//.
//. ### Functions
//.
//# bootstrap :: Array (Bootstrapper a b) -> Hook (Future c a) (Services b)
//.
//. Given a list of service bootstrappers, returns a `Hook` that represents the
//. acquisition and disposal of these services. Running the hook allows for
//. consumption of the services.
export const bootstrap = bootstrappers => {
  check(bootstrappers);
  return complete(bootstrappers, Hook.of({}));
};

//. [Fluture]: https://github.com/fluture-js/fluture
//. [Fluture Hooks]: https://github.com/fluture-js/fluture-hooks
