# Booture

Application bootstrapping on top of [Fluture Hooks][].

Booture uses Hooks (as you might expect) to ensure that whatever happens,
once a service is acquired, it will always be disposed. Furthermore,
acquisition and disposal of services happens at optimal parallelism.

Booture exposes a single function: [`bootstrap`](#bootstrap), which in
combination with [Fluture][] and [Fluture Hooks][], provides an ideal
platform for control over your application lifecycle.

## Usage Example

```console
npm install fluture booture fluture-hooks
```

The example below defines four "services": `config`, `postgres`, `redis`,
and `app`. The App depends on Redis and Postgres having been initialized,
which in turn depend on the Config service.

The consumption of these services happens in the form of binding the App to
a port, and waiting for SIGINT to complete the consumption.

```js
import {Future, node, fork, attempt} from 'fluture';
import {bootstrap} from 'booture';
import {hook, acquire, runHook} from 'fluture-hooks';

const acquireConfig = (
  attempt (() => ({
    redis: {url: process.env.REDIS_URL},
    postgres: {url: process.env.POSTGRES_URL},
  }))
);

const acquirePostgres = config => (
  node (done => require ('imaginary-postgres') .connect (config, done))
);

const acquireRedis = config => (
  node (done => require ('imaginary-redis') .connect (config, done))
);

const closeConnection = connection => (
  node (done => connection.end (done))
);

const acquireApp = (redis, postgres) => (
  attempt (() => require ('./imaginary-app').create (redis, postgres))
);

const bootstrapConfig = {
  name: 'config',
  needs: [],
  bootstrap: () => acquire (acquireConfig),
};

const bootstrapPostgres = {
  name: 'postgres',
  needs: ['config'],
  bootstrap: ({config}) => hook (acquirePostgres (config.postgres)) (closeConnection),
};

const bootstrapRedis = {
  name: 'redis',
  needs: ['config'],
  bootstrap: ({config}) => hook (acquireRedis (config.redis)) (closeConnection),
};

const bootstrapApp = {
  name: 'app',
  needs: ['redis, postgres'],
  bootstrap: ({redis, postgres}) => acquire (acquireApp (redis, postgres)),
};

const servicesHook = bootstrap ([ bootstrapConfig,
                                  bootstrapPostgres,
                                  bootstrapRedis,
                                  bootstrapApp ]);

const withServices = runHook (servicesHook);

const program = withServices (({app}) => Future ((rej, res) => {
  const conn = app.listen (3000);
  conn.once ('error', rej);
  process.once ('SIGINT', res);
}));

fork (console.error) (console.log) (program);
```

Some things to note about the example above, and general usage of Booture:

1. `servicesHook` is a `Hook`, so before running it, it can be composed
   with other hooks using `map`, `ap`, and `chain`, and even used in the
   definition of other bootstrappers.
2. `program` is a `Future`, so nothing happens until it's forked. Before
   forking it, it can be composed with other Futures using `map`, `ap`,
   `bimap`, and `chain`, or any of the other functions provided by Fluture.

## API

### Types

```hs
type Name = String
type Services a = Dict Name a
data Bootstrapper a b = Bootstrapper {
  name :: Name,
  needs :: Array Name,
  bootstrap :: Services b -> Hook (Future c a) b
}
```

### Functions

#### <a name="bootstrap" href="https://github.com/fluture-js/booture/blob/master/index.js#L187">`bootstrap :: Array (Bootstrapper a b) -⁠> Hook (Future c a) (Services b)`</a>

Given a list of service bootstrappers, returns a `Hook` that represents the
acquisition and disposal of these services. Running the hook allows for
consumption of the services.

[Fluture]: https://github.com/fluture-js/fluture
[Fluture Hooks]: https://github.com/fluture-js/fluture-hooks
