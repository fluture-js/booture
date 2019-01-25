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

const withServices = runHook (bootstrap ([ bootstrapConfig,
                                           bootstrapPostgres,
                                           bootstrapRedis,
                                           bootstrapApp ]));

const program = withServices (({app}) => Future ((rej, res) => {
  const conn = app.listen (3000);
  conn.once ('error', rej);
  process.once ('SIGINT', res);
}));

fork (console.error) (console.log) (program);
```

## API

### Types

```hs
type Name = String
data Bootstrapper a b = Bootstrapper {
  name :: Name,
  needs :: Array Name,
  bootstrap :: Hook (Future Error a) b
}
```

### Functions

#### <a name="bootstrap" href="https://github.com/fluture-js/booture/blob/master/index.mjs#L139">`bootstrap :: Array (Bootstrapper a b) -⁠> Hook (Future Error a) (StrMap b)`</a>

Given a list of service bootstrappers, returns a `Hook` that represents the
acquisition and disposal of these services. Running the hook allows for
consumption of the services.

[Fluture]: https://github.com/fluture-js/fluture
[Fluture Hooks]: https://github.com/fluture-js/fluture-hooks
