import {PubSubEngine} from 'graphql-subscriptions/dist/pubsub';
import * as OplogObserver from 'mongo-oplog';
import * as _ from 'lodash';
import * as Matcher from './matcher';

export interface PubSubMongoOptions {
  dbName: string,
  oplogUrl: string,
  connectionListener?: (err: Error) => void;
}

/* e.g. 
 * { ts: Timestamp { _bsontype: 'Timestamp', low_: 1, high_: 1475880595 },
  t: 2,
  h: Long { _bsontype: 'Long', low_: 577614824, high_: -142904721 },
  v: 2,
  op: 'u',
  ns: 'meteor.test',
  o2: { _id: 'BPDfKZjdFJ2uLTF3f' },
  o: { _id: 'BPDfKZjdFJ2uLTF3f', foo: 'bars' } }
 */
export interface OplogMessage{
  ts: any
  t: number,
  op: string,
  ns: string
  v: number,
  o2?: any
  o: any
}

const escapeRegExp = function (string:string) : string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const oplogEvents : {i: string, u: string, d: string} = {
  i: 'insert',
  u: 'update',
  d: 'delete'
};

export class MongoPubSub implements PubSubEngine {

  constructor(options: PubSubMongoOptions) {

    this.observer = OplogObserver(options.oplogUrl, { ns: '^' + escapeRegExp(options.dbName) + '\\.' });

    this.observer.on('op', this.onMessage.bind(this));

    if (options.connectionListener) {
      this.observer.on('error', options.connectionListener);
      this.observer.on('end', options.connectionListener);
      this.observer.stop(options.connectionListener);
    }

    this.subscriptionMap = new Map<number,{trigger:string,matcherId:number,onMessage:Function}>();
    this.triggerMap = new Map<string,Array<{matcher:any,query:Object,matcherId:number,subscribers:Array<number>}>>();
    this.currentSubscriptionId = 0;
    this.currentMatcherId = 0;

    this.observer.tail();
  }

  public publish(trigger: string, payload: any): boolean {
    return true;
  }

  public subscribe(trigger: string, onMessage: Function, channelOptions: {query:Object} = {query:{}}): Promise<number> {

    const id = this.currentSubscriptionId++;

    if(!this.triggerMap.has(trigger)){
      this.triggerMap.set(trigger,[]);
    }

    const existingSubscriptionSet = this.triggerMap.get(trigger).find(subscriptionSet => _.isEqual(subscriptionSet.query,channelOptions.query));
    
    let matcherId;
    if(existingSubscriptionSet){
        matcherId = existingSubscriptionSet.matcherId;
        existingSubscriptionSet.subscribers.push(id);
    }else{
        matcherId = this.currentMatcherId++;
        this.triggerMap.get(trigger).push({
          matcherId,
          query: channelOptions.query,
          matcher: new Matcher(channelOptions.query),
          subscribers: [id]
        });
    }

    this.subscriptionMap.set(id,{trigger,matcherId,onMessage});
    return Promise.resolve(id);

  }

  public unsubscribe(subId: number) {
    if (!this.subscriptionMap.has(subId))
      throw new Error(`There is no subscription of id "${subId}"`);

    const subscription = this.subscriptionMap.get(subId);
    this.subscriptionMap.delete(subId);

    const subscriptionSet = this.triggerMap.get(subscription.trigger).find(subscriptionSet => subscriptionSet.matcherId === subscription.matcherId);
    subscriptionSet.subscribers = subscriptionSet.subscribers.filter(subscriber => subscriber !== subId);
    if(subscriptionSet.subscribers.length === 0){
       this.triggerMap.set(subscription.trigger, this.triggerMap.get(subscription.trigger).filter(ss => ss !== subscriptionSet));
       if(this.triggerMap.get(subscription.trigger).length === 0){
         this.triggerMap.delete(subscription.trigger);
       }
    }
  }

  private onMessage(message: OplogMessage) {
    if(!message.op || !oplogEvents.hasOwnProperty(message.op) || !message.ns)
      return;

    const op : string = oplogEvents[message.op];
    const collection = message.ns.substr(message.ns.indexOf('.')+1);

    const channels = [
      `${collection}`,
      `${collection}_${op}`,
       message.o._id.toString(),
      `${message.o._id}_${op}`,
    ];

    channels.forEach(channel => {
      this.broadcast(channel, message.o);
    });
  }

  private broadcast(channel:string, message:string){

    if(!this.triggerMap.has(channel))
      return;

    const subscriptionSets = this.triggerMap
    .get(channel)
    .filter(ss => ss.matcher.documentMatches(message));

    for(let subscriptionSet of subscriptionSets){
        for(let subId of subscriptionSet.subscribers){
          this.subscriptionMap.get(subId).onMessage(message);
        }
    }
  }

  private observer: OplogObserver;
  private subscriptionMap;
  private triggerMap;
  private currentSubscriptionId: number;
  private currentMatcherId: number;
}