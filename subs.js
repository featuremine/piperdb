const PiperClient = require('./client.js');

let client = new PiperClient({port:8124, host:'localhost'});
client.on('error', (e)=>{console.log(e)});
client.on('connect', ()=>{
	client.authenticate_user("user1", "pass");
	['key/hello', 'key1/bye'].forEach((key)=>{
		client.subscribe(key, (val)=>{
			console.log(`got updated value ${val} on ${key}`);
		}).then(()=>{console.log(`subscribed to key ${key}`)})
		  .catch((e)=>{console.log(`failed to subscribe to key ${key} with error ${e}`)});
	});
});

client.connect();
