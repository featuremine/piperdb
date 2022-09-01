const PiperClient = require('./client.js');
const repl = require('repl');

const args = require('minimist')(process.argv.slice(2), {
        default: {
                host: 'localhost',
                port: 8124,
                timeout: 5000
        }
});

let client = new PiperClient({port:args.port, host:args.host, timeout:args.timeout});
client.on('error', (e)=>{console.log(e)});
client.on('connect', ()=>{console.log('client connected');});

let subs = new Map();

let cmds = {
	pub: (line) => {
		let [_, key, obj] = line.match(/\s*(\S+)\s+(.+)/);
		let value = JSON.parse(obj);
		client.publish(key, value)
			.then(()=>{console.log(`published ${JSON.stringify(value)} on ${key}`)})
			.catch((e)=>{console.log(`failed to publish on ${key} with error ${e}`)});
		return `sent pub request on ${key}`;
	},
	sub: (line) => {
		let key = line.trim();
		if (subs.has(key)) {
			return `sub callback already exists on ${key}`;
		}
		let callback = (val)=>{console.log(`${key} => ${JSON.stringify(val)}`)};
		client.subscribe(key, callback)
			.then(() => {
				subs.set(key, callback);
				console.log(`subscribed on ${key}`)
			})
		 	.catch((e)=>{console.log(`failed to subscribe on ${key} with error ${e}`)});
		return `sent sub request on ${key}`;
	}
}
function repl_eval(line, context, filename, callback) {
	let [_, cmd, input] = line.match(/\s*(\S+)\s+(.+)/);
	if (cmd in cmds) {
		try {
			return callback(null, cmds[cmd](input));
		} catch (e) {
			return callback(null, `error: ${e}`);
		}
	} else {
		return callback(null, 'error: unknown command');
	}
}

repl.start({ prompt: '> ', eval: repl_eval });

client.connect(args.user, args.password);
