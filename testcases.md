# Testing cases for piperdb

## Starting a server
- Attempt to start a server without arguments (defaults: port 8124, bucket 'fm-piperdb-config', prefix 'users-config'), succeeded as expected.
- Attempt to start a server passing only port, succeeded as expected.
- Attempt to start a server passing only bucket, succeeded as expected.
- Attempt to start a server passing only prefix, succeeded as expected.
- Attempt to start a server with port and bucket, succeeded as expected.
- Attempt to start a server with bucket and prefix, succeeded as expected.
- Attempt to start a server with port and prefix, succeeded as expected.
- Attempt to start a server with all three arguments: port, bucket and prefix, succeeded as expected.

## Starting a client (cli.py)
- Attempt to start a client without arguments, failed as expected: ```cli.py: error: the following arguments are required: host, port```
- Attempt to start a client only with host, failed as expected: ```cli.py: error: the following arguments are required: port```
- Attempt to start a client only with port, failed as expected: ```cli.py: error: the following arguments are required: port```
- Attempt to start a client with host and port, succeeded as expected: ```Connecting on host localhost, port 8124.```

## Authentication
- Attempt authentication using correct username and password, succeeded as expected: ```user1 User logged in```
- Attempt authentication using correct username but wrong password, failed as expected: ```Error: Wrong credentials for user: user2```
- Attempt authentication using wrong username but correct password, failed as expected:  ```Error: Wrong credentials for user: user2```

## Whitelist
- IP included in the Whitelist is recognized as such, succeeded as expected: ```Whitelisted``` 
- Client connecting from whitelisted IP can publish without authentication. ```sent pub request on key key/100```, ```resolve pub 256```, ```published "newValue" on key/100```
- Client connecting from whitelisted IP can subscribe without authentication. ```sent sub request on key key/100```, ```resolve sub 256```, ```key/100 => "newValue"```, ```subscribed on key/100```
- Client connecting from whitelisted IP can receive updates from subscribed keys. ```key/100 => "newnewnew"```
- Attempt to send auth message from a whitelisted client, failed as expected. ```expecting channel ID as a first element```


## Kickout
- Connecting with an already logged in user produces prompt "Another client is already connected...(yes/no)?".
- Replying ```auth yes``` to the prompt results in the previously open user being kicked out.
- Replying ```auth no``` to the prompt results in the user attempting the login being kicked out.

## Creating, Publishing and Subscribing
- Attempt key creation from a user with create_keys=true, succeeded as expected: ```sent pub request on key key/100```, ```resolve pub 256```, ```published "Value" on key/100```
- Attempt key creation from a user with create_keys=false, failed as expected: ```sent pub request on key key/101```, ```failed to subscribe on key key/101 with error Current user doesn't have permisions```
- Attempt to subscribe to a key and get updates, succeeded as expected.

## Batchpub script
- Attempt to run script without username and password, non-whitelisted IP, failed as expected. ```...Error: User not found: 0 failed to publish 40000000 on key/fsa_tgt.opt_params.constraint_limits.gics_ig0 with error undefined```
- Attempt to run script with username and password, non-whitelisted IP, succeeded as expected. ```...published 3 successfully and 0 failures```

- Attempt to run script without username and password, whitelisted IP, succeeded as expected. ```...published 3 successfully and 0 failures```
- Attempt to run script with username and password, whitelisted IP, failed as expected. ```failed to authenticate with error: expecting channel ID as a first element```