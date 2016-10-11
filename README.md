# graphql-mongo-subscriptions (WIP)

This package implements the PubSubEngine Interface from the graphql-subscriptions package. 
It allows you to connect your subscriptions manager to mongo oplog events.

**Work in progress**
   
   
## Usage
### Creating a pubsub

You need to specify how to connect to mongodb. e.g.
 
```javascript
import { MongoPubSub } from 'graphql-mongo-subscriptions';

const pubsub = new MongoPubSub({
  connection: {
    oplogUrl: 'mongodb://user:pass@host1:port,host2:port,host3:port/local',
    dbName: 'myDatabase'
  }
});
```

### Listening to events
The pub sub system listens to the oplog and triggers the following events:
 - `collectionName` e.g. `comments`
 - `collectionName_operationName` e.g. `comments_insert`
 - `objectId` e.g. `57fd15529b97251fe2c5fd7d`
 - `objectId_operationName` e.g. `57fd15529b97251fe2c5fd7d_update`

```javascript
import { MongoPubSub } from 'graphql-mongo-subscriptions';
import { SubscriptionManager } from 'graphql-subscriptions';
import schema from './schema';

const pubsub = new MongoPubSub(...);

const subscriptionManager = new SubscriptionManager({
  schema,
  pubsub,
  setupFunctions: {
    commentAdded: (options, args) => ({
      comments_added: {
        channelOptions: {
          query: {repoName: {$in: args.reposIFollow}}
        }
      },
    }),
  },
});
```
