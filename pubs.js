const PiperClient = require('./client.js');

let client = new PiperClient({port:8124, host:'localhost'});
client.on('error', (e)=>{console.log(e)});
client.on('connect', ()=>{
	console.log('client connected');
	client.authenticate_user("user1", "pass");
	[0,1,2,3,4,5,6,7,8,9].forEach((x) => {
		['key2/hello', 'key3/bye'].forEach((key)=>{
			client.publish(key, `hey there ${x}`)
				.then(()=>{console.log('success')})
				.catch((e)=>{console.log(`failure ${e}`)});
		});
	});
});
client.connect();



