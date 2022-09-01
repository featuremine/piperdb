const net = require('net');
const events = require('events');
const { write } = require('fs');
const pack = require('msgpack5')();

class PiperClient extends events {
	constructor(first, second, third) {
		super();

		if (Number.isInteger(first) && (Number.isInteger(third))) {
			this.options = {port: first, host: second, timeout: third};
		} else if (first instanceof String) {
			this.options = {path: first};
		} else if (first instanceof Object) {
			this.options = first;
		}
		this.subs = new Map();


	}
	connect(user, password) {
		if (this.connection) {
			return;
		}
		let socket = new net.Socket();
		socket.on('connect', () => {
			this.connection = {
				socket: socket,
				ids: new Map(),
				callbacks: new Map(),
				promises: []
			};
			if(user && password){
				this.connection.socket.write(pack.encode([user, password]));	
			}
			else{
				this.emit('connect');
			}
			this.connection.promises.push({
				resolve: (m) => {
					console.log(`connected with the message: ${m}`);
					this.subs.forEach((callbacks,key) => {callbacks.forEach((callback) => {this.subscribe(key,callback)});});
					this.emit('connect');
				},
				reject: (e) => {
					console.log(`failed to authenticate with error: ${e}`);
					this.connection.socket.end();
				}
			});
		});
		let decoder = pack.decoder();
		decoder.on('data', (data)=>{this._read(data)});

		socket.pipe(decoder);
		socket.on('error', (e)=>{
			if (this.options.timeout) {
				socket.setTimeout(this.options.timeout,()=>{this.connect(user, password)});
			}
			this.emit('error', e);
		});
		socket.on('end',()=>{
			socket.destroy();
			if (this.options.timeout) {
				socket = new net.Socket();
				socket.setTimeout(this.options.timeout,()=>{this.connect(user, password)});
			}
		});
		socket.on('close', ()=>{this.connection = undefined});
		socket.connect(this.options);
	}
	_callbacks(id) {
		let callbacks = this.connection.callbacks;
		if (!callbacks.has(id)) {
			callbacks.set(id, []);
		}
		return callbacks.get(id);
	}
	_subs(key) {
		let subs = this.subs;
		if (!subs.has(key)) {
			subs.set(key, new Set());
		}
		return subs.get(key);
	}
	subscribe(key, callback) {
		if (!this.connection) {
			return Promise.reject('connection is down');	
		}
		let ids = this.connection.ids;
		if (ids.has(key)) {
			let id = ids.get(key);
			this._callbacks(id).push(callback);
			this.subs.add({key:key, callback: callback});
			return Promise.resolve();
		}
		return new Promise((resolve, reject) => {
			this.connection.socket.write(pack.encode([0, 'sub', key]));
			this.connection.promises.push({
				resolve: (id, data) => {
					ids.set(key, id);
					this._callbacks(id).push(callback);
					this._subs(key).add(callback);
					callback(data);
					resolve();
				},
				reject: (e) => {
					reject(`server error ${e}`);
				}
			});
		});
	}

	publish(key, value) {
		if (!this.connection) {
			return Promise.reject('connection is down');	
		}
		let ids = this.connection.ids;
		if (ids.has(key)) {
			let id = ids.get(key);
			try {
				this.connection.socket.write(pack.encode([id, value]));
			} catch(e) {
				return Promise.reject(e);
			}
			return Promise.resolve();
		}
		return new Promise((resolve, reject) => {
			try {
				this.connection.socket.write(pack.encode([0, 'pub', key, value]));
			} catch(e) {
				reject(e);
				return;
			}
			this.connection.promises.push({
				resolve: (id) => {
					ids.set(key, id);
					resolve();
				},
				reject: (e) => {
					reject();
					throw `server error ${e}`;
				}
			});
		});
	}
	_read(data) {
		// Need to abstract this checking as a transform class
		if (!(data instanceof Array)) {
			_clientError(socket, 'expecting array');
			return;
		}
		if (!data.length) {
			_clientError(socket, 'expecting a non-empty array');
			return;
		}
		if (!Number.isInteger(data[0])) {
			_clientError(socket, 'expecting channel ID as a first element');
			return;
		}
		let channel = data.shift();
		if (channel > 0) {
			let callbacks = this.connection.callbacks;
			if (!callbacks.has(channel)) {
				this._error(`unknown channel ${channel}`)
				return;
			}
			callbacks.get(channel).forEach((f)=>{f(data[0])});
		} else {
			let promises = this.connection.promises.shift();
			try {
				if (channel == 0) {
					promises.resolve.apply(this, data);
				} else if (channel == -1) {
					promises.reject.apply(this, data);
				}
			} catch (e) {
				this._error(e);
				return;
			}	
		}
	}
	_error(e) {
		this.emit('error', e);
		this.connection.socket.destroy();		
	}
}

module.exports = PiperClient;
