# Getting started

## System requirements

- Node.js 12.15
- Python 3.8.5

## Installation
Clone or download piperdb repository, go to the root folder, and install dependencies.

If you're using npm to install:

`npm install` 

>Note: Server has dependencies with packages `minimist`, `msgpack5`, and `aws-sdk`.

## Running Server

Once all dependencies are installed you will be able to run the piperDB server.

`node server.js`

By default the server runs in port 8124, loading configurations from bucket 'fm-piperdb-config' with the prefix 'users-config/'.

You can choose the server port by passing it as a parameter:

`node server.js --port 8080`

You can pass a bucket's name as an argument when starting the server. 

`node server.js --bucket fm-piperdb-config`

Likewise, you can specify a prefix to be prepended to the config files' names.

`node server.js --prefix test-config/`

>Note: S3 files should be public to allow the server to access them.

Once the server starts it will show that the configuration was loaded.

The file the server logs are written to can be configured using the `--logs` option.

`node server.js --logs logfilename.log`
```
~/piperdb$ node server.js

server listening
users.json file load from S3
policies.json file load from S3
ip_lists.json file load from S3
```

### Configuration structure

Each file is a JSON file that contains information about the configuration of the users. The following is a users.json example.

```
[
  {
    "user": "user1",
    "properties": {
      "password": "password1",
      "policy": "noninteractive",
      "ips": "ip_list1",
      "create_keys" : true
    }
  },
  {
    "user": "user2",
    "properties": {
      "password": "password2",
      "policy": "interactive",
      "ips": "ip_list2",
      "create_keys" : false
    }
  }
]
```

Each user has associated a keys policy and IP list that should be defined in the other configuration files, the policies.json files should look like:

```
{
  "noninteractive" : {
    "keys" : [
      "key*",
      "validation*"
    ]
  },
  "interactive" : {
    "keys" : [
        "key*"
    ]
  }
}
```
> Note: Each policy key should be checked like a regular expression.

Meanwhile, the IP list allowed should look like this:

```
[
  {
    "list_name" : "ip_list1",
    "ips": [
	    "192.168.1.1",
      "192.168.1.10"
    ]
  },
  {
    "list_name" : "ip_list2",
    "ips": [
	    "192.168.1.100",
      "192.168.1.200"
    ]
  }
]
```
### IP Whitelist

Adding an entry to the IP list with the name "whitelist" will result in the IPs included in the list bypassing authentication.

An ip_lists.json configuration file with a whitelist would look like this:

```
[
  ...,
  {
    "list_name" : "whitelist",
    "ips": [
	    "127.0.0.1"
    ]
  },
  ...
]
```

## Running Client

To run a client you can execute the following command: 

```
python cli.py (hostname) (port)
```

For instance, to run a client that connects to localhost on port 8100 you would run:

```
python cli.py localhost 8100
```

Once the client is running it will be able to send the following messages to the server:

```
[channel, 'pub', key, value]
[channel, 'sub', key]
[user, password]
```

If the client is not authenticated the server doesn't allow to publish or subscribe to any key, unless the client's IP is in the server's whitelist.


## Authentication process

All incoming connections must go through an authentication process before starting to publish or subscribe to any key.

When a new client connects to the server, the client should send the user credentials to the server. 
The client should send an array with the user information.
For testing purposes we have adapted the client.py and cli.py scripts to handle the authentication process. 

To use either of these clients, run the script and send the following commands:

```
~/piperdb$ python cli.py

auth username password
username User logged in
```

Upon successful authentication, the following message is displayed:

```
username User logged in
```

Once the user is authenticated, the client can start publishing or subscribing to keys.

### Users support

Currently, the server allows just one client to be logged in with the same user. 
When the server gets an authentication request for a user that is already logged in, the server asks the new client if it wants to log out of the existing session.

```
~/piperdb$ python cli.py

auth username password
Another client is already connected. Do you want to disconnect previous session (yes/no)?
```

In this case, the client should respond with auth yes or auth no to select the session that is going to continue.

If the client response is auth yes, the server will close the socket of the previous client,

```
~/piperdb$ python cli.py
auth username password
Another client is already connected. Do you want to disconnect previous session (yes/no)?
auth yes
Connection terminated by user1 9/7/2021 11:6:21
```

 If the client response is auth no, the server will close the socket with the current client.

```
~/piperdb$ python cli.py
auth username password
Another client is already connected. Do you want to disconnect previous session
 (yes/no)?
auth no
Connection terminated 9/7/2021 11:7:56
connection lost, reconnecting after timeout.
```


## Publish

Once the client is authenticated it will be able to publish a value to a key, only if the user has the policy enabled. 

```
~/piperdb$ python cli.py
auth user password
user User logged in
pub key/100 "newValue"
sent pub request on key key/100
resolve pub 256
published "newValue" on key/100
```

## Subscribe

Once the client is authenticated it will be able to subscribe to any key,  only if the user has the policy enabled. 

```
~/piperdb$ python cli.py
auth user password
user User logged in
sub key/100
sent sub request on key key/100
resolve sub 256
key/100 => "newValue"
subscribed on key/100
```

## The batchpub script.

Batchpub will publish all the keys in a .JSON file.
You can run the script using the following command:

```
node batchpub.js sample.json --host hostname --port port --user username --password password 
```

If hostname and port number are not provided, they will default to 'localhost' and '8124', respectively.
If username and password are not provided, publication of the keys will fail due to authentication, unless the IP the script is being run from is included in the config's Whitelist, in which case authentication is bypassed.

