from client import PiperClient
from aioconsole import ainput
import json
import asyncio
import argparse

class PiperCLI():
	
	def __init__(self, host, port, loop, timeout=5):
		self.loop = loop
		self.subs = {}
		self.pc = PiperClient(host,port, loop, timeout)
		self.pc.connect()
		self.loop.run_until_complete(self.main())
		
	async def main(self):
		while True:
			try:
				line = await ainput()
				cmd, _, inp = line.strip().partition(" ")
				if cmd == "sub":
					key = inp.strip()
					if not key:
						print("Wrong arguments. Try: sub STATE_NAME", flush=True)
						continue
					if key in self.subs:
						print("already subscribed to key {0}".format(key), flush=True)
						continue

					def _callback(val,key=key):
						print("{0} => {1}".format(key, json.dumps(val)), flush=True)

					def sub_(future):
						if not future.exception():
							self.subs[key] = _callback
							print("subscribed on {0}".format(key), flush=True) 
						else:
							print("failed to subscribe on key {0} with error {1}".format(key, future.exception()))

					self.pc.subscribe(key, _callback).add_done_callback(sub_)
					print("sent sub request on key {}".format(key), flush=True)
					continue
				
				if cmd == "pub":
					key , _, rest = inp.strip().partition(" ")
					objstr = rest.strip()
					if not key or not objstr:
						print("Wrong arguments. Try: pub STATE_NAME STATE_VALUE", flush=True)
						continue

					try:
						obj = json.loads(objstr)
					except:
						print("Expecting int, float or quoted string",flush=True)
						continue
					def pub_(future):
						if not future.exception():
							print("published {0} on {1}".format(json.dumps(obj), key), flush=True)
						else:
							print("failed to subscribe on key {0} with error {1}".format(key, future.exception()))

					self.pc.publish(key, obj).add_done_callback(pub_)
					print("sent pub request on key {0}".format(key), flush=True)
					continue
				if cmd == "auth":
					user, _, password = inp.strip().partition(" ")
					if not user :
						print("Wrong arguments. Try: 'auth' 'user' 'password' or 'auth' 'yes/no'", flush=True)
						continue

					def cred_(future):
						if not future.exception():
							print(future.result(), flush=True)
						else:
							print(future.exception())

					self.pc.authentication(user, password).add_done_callback(cred_)
					continue
				if cmd == "close":
					self.pc.close()
					break
				else:
					print("Wrong command. Try: pub, sub, auth or close", flush=True)
			except Exception as e:
				print("An error occurred:",e.args[0], flush=True)
	
if __name__ == '__main__':
	loop = asyncio.get_event_loop()	
	
	parser = argparse.ArgumentParser(description = 'Start piperdb client.')
	parser.add_argument('host', type=str, help='Hostname the client will connect to.')
	parser.add_argument('port', type=int, help='Port number the client will connect to.')
	host = parser.parse_args().host
	port = parser.parse_args().port

	try:
		print(f"Connecting on host {host}, port {port}.\n")
		client = PiperCLI(host,port,loop)
	except KeyboardInterrupt as e:
		print("have a nice day")
	loop.stop()
	loop.close()
