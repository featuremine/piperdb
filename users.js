var AWS = require('aws-sdk');
var s3 = new AWS.S3();

const user_file_name = 'users.json'
const policies_file_name = 'policies.json'
const ip_file_name = 'ip_lists.json'

const users_lf = require('./config/'+user_file_name);
const policies_lf = require('./config/'+policies_file_name);
const ip_lists_lf = require('./config/'+ip_file_name);


function params(bucket, key) {
	return {
		Bucket: bucket,
 		Key: key
	};
}


const auth_states = {
	SOCKET_AUTH: "socket_auth",
	NO_USER_LOGGED: "no_user_logged",
	USER_RECEIVED: "user_received",
	WRONG_USER: "wrong_user",
	WAITING_CLIENT_RESPONSE: "wait_client",
	CLOSE_SOCKET: "close_socket"
}


function pretty_socket_info(socket) {
	return `${socket.remoteAddress}:${socket.remotePort}`
}

class LoggedUsers {
    constructor(bucket, prefix){

        this.is_authenticated = new Map();
        this.logged_users = new Map();
        this.waiting_client = new Map();
        this.user_regex = new Map();

		this.load_configuration(bucket, prefix, user_file_name, (error, data) => {
			if (error !== null) {
				console.log(`${error}`);
				this.users = users_lf;
			}else{
				console.log(`${user_file_name} file load from S3`);
				this.users = JSON.parse(data);
			}
			this.load_configuration(bucket, prefix, policies_file_name, (error, data) => {
				if (error !== null) {
					console.log(`${error}`);
					this.policies = policies_lf;
				} else {
					console.log(`${policies_file_name} file load from S3`);
					this.policies = JSON.parse(data);
				}
				this.load_configuration(bucket, prefix, ip_file_name, (error, data) => {
					if (error !== null) {
						console.log(`${error}`);
						this.ip_lists = ip_lists_lf;
					} else {
						console.log(`${ip_file_name} file load from S3`);
						this.ip_lists = JSON.parse(data);
					}
					this.load_user_regex();
				});
			});

		});
    }

	load_user_regex(){
		// get regex by users
		for (var i = 0; i < this.users.length; i++) {
			let policy_name = this.users[i].properties.policy;
			let policy = this.policies[policy_name];
			var user_reg = [];
			for (var j = 0; j < policy.keys.length; j++) {
				const regex = new RegExp(policy.keys[j]);
				user_reg.push(regex);
			}
			this.user_regex.set(this.users[i].user, user_reg);
		}
	}

	load_configuration(bucket, prefix, key, callback){
    	s3.getObject(params(bucket,prefix+key), function (err, data) {
			if(err){
				callback(new Error(`Couldn't find configuration file ${key} in bucket ${bucket}`));
			}else{
				callback(null, data.Body.toString('utf-8'));
			}
		});
	}

    print_users_map( map ){
		if(map.size>0){
			map.forEach((value, key)=>{
				console.log(`key ${key} , value: ${value}`);
			});
		}
	}

	authentication_correct(user, password, socket, clb) {
		let user_data = this.users.find(x => x.user === user);
		if(!user_data){
			clb(new Error(`User not found: ${user}`));
			return;
		}
		if(user_data.properties.password !== password){
			clb(new Error(`Wrong credentials for user: ${user}`));
			return;
		}

		let ip_allowed = false;
		let ip_list_name = user_data.properties.ips;
		let ip_list = this.ip_lists.find(x => x.list_name === ip_list_name);

		if(!ip_list){
			clb(new Error(`Ip ${socket.remoteAddress} not allowed to user ${user}`));
			return;
		}

		for (var j = 0; j < ip_list.ips.length; j++) {
			let ip_remote = socket.remoteAddress;
			if (ip_remote.substr(0, 7) === "::ffff:") {
			  ip_remote = ip_remote.substr(7)
			}
			if(ip_remote === ip_list.ips[j]){
				ip_allowed=true;
				break;
			}
		}

		if(!ip_allowed){
			clb(new Error(`Ip ${socket.remoteAddress} not allowed to user ${user}`));
			return;
		}
		clb(null, `${user} User logged in`);
	}

	reset_authentication(socket, callback){

		if(this.is_authenticated.has(pretty_socket_info(socket))){
			this.is_authenticated.set(pretty_socket_info(socket), false);
		}
		let user_log = [...this.logged_users.entries()]
			.filter(({ 1: v }) => v === socket)
			.map(([k]) => k);
		this.logged_users.delete(user_log[0]);
		callback(null, `Reset socket ${pretty_socket_info(socket)}`);
	}

	check_authentication(socket, data, callback) {
        if (!this.is_authenticated.has(pretty_socket_info(socket))){
        	this.is_authenticated.set(pretty_socket_info(socket), false);
        }

		if (!this.is_authenticated.get(pretty_socket_info(socket))) {
			// Expecting user and password
			let user = data[0];
			let password = data[1];

			// confirmation message
			if(!password){
				let cmd = data[0];

				let user_wait = [...this.waiting_client.entries()]
					.filter(({ 1: v }) => v === pretty_socket_info(socket))
					.map(([k]) => k);
					if (cmd.startsWith("yes")) {
						let logged = this.logged_users.keys().next().value;
						let socket_logged = this.logged_users.get(logged);
						this.logged_users.delete(logged);
						this.logged_users.set(user_wait[0], socket );
						this.is_authenticated.delete(pretty_socket_info(socket_logged));
						this.is_authenticated.set(pretty_socket_info(socket), true);
						callback(auth_states.CLOSE_SOCKET, `Connection terminated by ${user_wait[0]} `, socket_logged);
						return;
					} else if (cmd.startsWith("no")) {
						callback(auth_states.CLOSE_SOCKET, `Connection terminated `, socket);
						return;
					}else{
						callback(auth_states.WAITING_CLIENT_RESPONSE, 'Command unknown: try "auth username password"');
						return;
					}
				callback(auth_states.WAITING_CLIENT_RESPONSE, 'Command unknown: try "auth username password"');
				return;
			}
			
			this.authentication_correct(user, password, socket, (error, result) => {
				if (error !== null) {
					callback(auth_states.WRONG_USER, `${error}`);
				}else{
					if (this.logged_users.size !== 0) {
						this.waiting_client.set(user, pretty_socket_info(socket) );
						callback(auth_states.WAITING_CLIENT_RESPONSE, "Another client is already connected. Do you want to disconnect the previous session (yes/no)?");
					}else{
						this.logged_users.set(user, socket);
						this.is_authenticated.set(pretty_socket_info(socket), true);
						callback(auth_states.USER_RECEIVED, result);
					}
				}
			});
        }else{
			let user_logged = [...this.logged_users.entries()]
				.filter(({ 1: v }) => v === socket)
				.map(([k]) => k);
			let user_data = this.users.find(x => x.user === user_logged[0]);
			callback( auth_states.SOCKET_AUTH, "ok", socket, this.user_regex.get(user_logged[0]), user_data.properties.create_keys,user_logged[0]);
		}
    }
}

module.exports = LoggedUsers;
