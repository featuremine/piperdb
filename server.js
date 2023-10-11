const net = require('net');
const events = require('events');
const pack = require('msgpack5')();
const LoggedUsers = require('./users.js');
const fs = require('graceful-fs')


const args = require('minimist')(process.argv.slice(2), {
		default: {
			port: 8124,
			bucket: "fm-piperdb-config",
			prefix: "users-config/",
			logs: "piperdb.log"
        }
});

var log_file = args.logs;

function current_date()
{
	const currentdate = new Date();
	return currentdate.getDate().toString().padStart(2, '0') + "/"
                + (currentdate.getMonth()+1).toString().padStart(2, '0')  + "/"
                + currentdate.getFullYear() + " "
                + currentdate.getHours().toString().padStart(2, '0') + ":"
                + currentdate.getMinutes().toString().padStart(2, '0') + ":"
                + currentdate.getSeconds().toString().padStart(2, '0') + " ";

}

function write_log_file(output)
{
	let datetime = current_date();
	let line = datetime + output + '\n';
	fs.appendFileSync(log_file, line);
}

function pretty_socket_info(socket) {
	return `${socket.remoteAddress}:${socket.remotePort}`
}


class PiperServer extends events {
	constructor(first, second, prefix) {
		super();
		if (first instanceof String) {
			this.options = {path: first};
		} else if (first instanceof Object) {
			this.options = first;
		}
		this.users = new LoggedUsers(second, prefix);
		this.server = new net.Server();
		this.index = 255;
		this.infos = new Map();
		this.keys = new Map();
		this.cmds = {
			sub: function(socket, key) {
				let info = this._channelInfo(key);
				info.subs.add(socket);
				this._send(socket, [0, info.index, info.data]);
			},
			pub: function(socket, key, value) {
				let info = this._channelInfo(key);
				this._publish(socket, info, value);
				this._send(socket, [0, info.index]);
			}
		};
	}

	_channelInfo(key) {
		if (this.keys.has(key)) {
			let index = this.keys.get(key);
			return this.infos.get(index);
		} else {
			this.index++;
			let index = this.index;
			let info = {
				subs: new Set(),
				index: index,
				key: key,
				data: null
			}
			this.infos.set(index, info)
			this.keys.set(key, index);
			return info;
		}
	}

	listen() {
		if (this.server.listening) {
			return;
		}

		this.server.on('connection', (socket) => {
			socket.on('error', (e)=>{
				this.emit('clientError', `client ${pretty_socket_info(socket)} : socket error ${e}`);
			});
			socket.on('close', ()=>{
				this.users.reset_authentication(socket, ()=>{
					this.emit('disconnection', pretty_socket_info(socket));
				})
			});
			
			let decoder = pack.decoder();
			socket.pipe(decoder);
			
			// Load Whitelist, Check if IP is in Whitelist
            if (this.users.ip_lists){
                var ip_list = this.users.ip_lists.find(x => x.list_name === "whitelist");
            }
            else{
                this.emit('disconnection', pretty_socket_info(socket));
            }
			let ip_remote = socket.remoteAddress;
			let whitelist = false;
			if (ip_remote.substr(0, 7) === "::ffff:") {
				ip_remote = ip_remote.substr(7);
				for (var j = 0; j < ip_list.ips.length; j++) {
					if(ip_remote === ip_list.ips[j]){
						whitelist = true;	
					}
				}
			}
			
			// if in whitelist then read the data
			if(whitelist){
				console.log("Whitelisted")
				decoder.on('data', (data)=>{
					this._read_socket_data(socket, data, [new RegExp(".*")] , true, "tplatform")
				});
			}
			
			// else, authentication is required
			else {
				decoder.on('data', (data)=>{
					this._authenticate(socket, data, decoder)
				});
			}
			
			decoder.on('error', (e)=>{
				this.users.reset_authentication(socket, ()=>{
					this.emit('clientError', `client ${pretty_socket_info(socket)}: protocol error ${e}`);
					socket.destroy();
				});
			});
			this.emit('connection', pretty_socket_info(socket));
		});

		this.server.on('error', (e)=>{
			console.log('error');
			this.users.reset_authentication(socket, ()=>{
				this.emit('error', e)
			});
		});
		this.server.on('close', ()=>{
			this.users.reset_authentication(socket, ()=>{
				this.emit('close')
			});
		});
		this.server.on('listening', ()=>{this.emit('listening')});
		this.server.listen(this.options);
	}

	_publish(socket, info, data) {
		let index = info.index;
		info.data = data;
		info.subs.forEach((client) => {
			if (client.destroyed) {
				info.subs.delete(client);
			} else {
				this._send(client, [index, data]);
			}
		});
	}

	_authenticate(socket, data, decoder) {
		// all data is assumed to be array
		// the first element should be a number specifying the
		// channel to be updated.
		// Zero is a reserved command channel.
		if (!(data instanceof Array)) {
			this._clientError(socket, 'expecting array');
			return;
		}
		if (!data.length) {
			this._clientError(socket, 'expecting a non-empty array');
			return;
		}
		this.users.check_authentication(socket, data,(authenticated, message, socket_close, keys, keys_creator, user) => {
			switch (authenticated) {
				case "socket_auth":
					console.log("socket_auth")
					this._read_socket_data(socket, data, keys, keys_creator, user);
					decoder.removeAllListeners('data');
					decoder.on('data', (data)=>{
						this._read_socket_data(socket, data, keys, keys_creator, user)});
					break;
				case "user_received":
					write_log_file(message);
					this._send(socket, [0,message]);
					break;
				case "wrong_user":
					this._clientError(socket, message);
					break;
				case "close_socket":
					let msg = message+current_date();
					write_log_file(msg);
					this._send(socket_close, [-1,msg]);
					this._close(socket_close);
					this._send(socket, [0, msg]);
					break;
				case "wait_client":
					this._send(socket, [-1,message]);
					break;
			}
		});
	}

	_read_socket_data(socket, data, keys, keys_creator, user) {
		// all data is assumed to be array
		// the first element should be a number specifying the
		// channel to be updated.
		// Zero is a reserved command channel.
		if (!(data instanceof Array)) {
			this._clientError(socket, 'expecting array');
			return;
		}
		if (!data.length) {
			this._clientError(socket, 'expecting a non-empty array');
			return;
		}
		if (!Number.isInteger(data[0])) {
			this._clientError(socket, 'expecting channel ID as a first element');
			return;
		}

		let channel = data[0];

		if (channel) {
			if (!this.infos.has(channel)) {
				this._clientError(socket, `no channel ${channel}`);
				return;
			}
			let info = this.infos.get(channel);
 			write_log_file(`${user} Published ${data[1]} on ${info.key}`);
 			this._publish(socket, info, data[1]);
		} else {

			// For command channel, expecting name of the command
			// followed by command arguments
			let cmd = data[1];
			if (!cmd instanceof String) {
				this._clientError(socket, `expecting command instead of ${cmd}`);
				return;
			}
			if (!(cmd in this.cmds)) {
				this._clientError(socket, `cannot find command ${cmd}`);
				return;			
			}

			try {
				var key_allowed = false;
				for (var i = 0; i < keys.length; i++) {
					if(keys[i].test(data[2])){
						key_allowed = true;
						break;
					}
				}
				if(!key_allowed){
					this._clientError(socket, `key ${data[2]} not allowed for current user`);
					return;
				}

				if(!this.keys.has(data[2]) && !keys_creator){
					this._clientError(socket, `Current user doesn't have permisions`);
					return;
				}

				let args = data.slice(2);
				args.unshift(socket);
				if (args.length===3){
					write_log_file(`${user} Published ${args[2]} on ${args[1]}`);
				}else if(args.length===2){
					write_log_file(`${user} Subscribed on ${args[1]}`);
				}
				this.cmds[data[1]].apply(this, args);
			} catch (e) {
				this._clientError(socket, `command ${cmd} failed with ${e}`);
			}
		}
	}

	_send(socket, data) {
		socket.write(pack.encode(data));
	}

	_clientError(socket, e) {
		this.emit('clientError', `client ${pretty_socket_info(socket)}: ${e}`);
		this._send(socket, [-1, e]);
	}

	_close(socket) {
		socket.destroy();
	}
}

let server = new PiperServer({port: args.port}, args.bucket, args.prefix);
console.log(args);
server.on('connection', (e)=>{console.log(`connected to ${e}`)});
server.on('disconnection', (e)=>{console.log(`disconnected from ${e}`)});
server.on('error', (e)=>{console.log(`server error ${e}`)});
server.on('close', (e)=>{console.log('server closed')});
server.on('listening', (e)=>{console.log('server listening')});
server.on('clientError', (e)=>{console.log(`client error ${e}`)});

server.listen();


