
const MongoPubSub = require('./dist/mongo-pubsub').MongoPubSub;

const pubsub = new MongoPubSub({
    dbName: 'meteor',
    oplogUrl: 'mongodb://127.0.0.1:3001/local'
});

pubsub.subscribe('test_insert', msg => {
    debugger;
    console.log(msg)
}, {query:{foo:'bar'}});

pubsub.subscribe('test_insert', msg => {
    console.log(msg)
}, {query:{foo:'bar'}}).then(subid => pubsub.unsubscribe(subid));


pubsub.subscribe('test_changed', msg => {
    console.log(msg)
}, {query:{foo:'bar'}});


pubsub.subscribe('test_changed', msg => {
    console.log(msg)
}, {query:{foo:'bar'}});


const subid2 = pubsub.subscribe('lala_changed', msg => {
    console.log(msg)
}, {query:{foo:'bar'}}).then(subid => pubsub.unsubscribe(subid));


const subid3 = pubsub.subscribe('lala_insert', msg => {
    console.log(msg)
}, {query:{foo:'bar2'}}).then(subid => pubsub.unsubscribe(subid));

const subid4 = pubsub.subscribe('lala_insert', msg => {
    console.log(msg)
}, {query:{foo:'bar2'}}).then(subid => pubsub.unsubscribe(subid));

