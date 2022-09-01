'use strict';

const EventEmitter = require('events');
const PiperClient = require('./client.js');
const fs = require('fs');
const args = require('minimist')(process.argv.slice(2), {
	default: {
		host: 'localhost',
		port: 8124
	}
});

class PubEmitter extends EventEmitter {}

let obj = JSON.parse(fs.readFileSync(args._[0], {encoding: 'utf8'}));
let client = new PiperClient({port:args.port, host:args.host});
const pubEmitter = new PubEmitter();

let pubSuccess = 0;
let pubFailure = 0;
let pubSent = 0;

function exitIfNeeded() {
	if (pubSuccess + pubFailure == pubSent) {
		console.log(`published ${pubSuccess} successfully and ${pubFailure} failures`);
		process.exit(pubFailure === 0 ? 0 : 1);
	}
}
pubEmitter.on('pubSucceeded', () => {
	++pubSuccess;
	exitIfNeeded();
});
pubEmitter.on('pubFailed', () => {
	++pubFailure;
	exitIfNeeded();
});

client.on('error', (e)=>{console.log(e)});
client.on('connect', ()=>{
	console.log('client connected');
	for (let key in obj) {
		let value = obj[key];
		console.log(`publishing ${JSON.stringify(value)} on ${key}`);
		++pubSent;
		client.publish(key, value)
			.then(()=>{
				console.log(`published ${JSON.stringify(value)} on ${key}`);
				pubEmitter.emit('pubSucceeded');
			})
			.catch((e)=>{
				console.log(`failed to publish ${JSON.stringify(value)} ` +
										`on ${key} with error ${e}`);
				pubEmitter.emit('pubFailed');
			});
	}
});	

client.connect(args.user, args.password);
