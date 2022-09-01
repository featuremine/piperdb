import asyncio
import collections
import queue
from msgpackstream import MsgpackProtocol

def transform(data):
	try:
		retdata = data.decode()
		return retdata
	except AttributeError:
		if not isinstance(data, (dict,collections.Sequence)):
			return data
	
	if isinstance(data, (dict)):
		retdata = {}
		for key in data:
			new_key = transform(key)
			new_data = transform(data[key])
			retdata[new_key] = new_data
		return retdata
	
	if isinstance(data, (collections.Sequence)):
		retdata = []
		for i in data:
			retdata.append(transform(i))
		return retdata

async def raise_(ex):
	raise ex
	
class PiperClient():

	def __init__(self, host, port, loop, timeout=5):
		self.loop = loop
		self.host = host
		self.port = port
		self.timeout = timeout
		self.connection = None
		self.subs = set()
		
	def connect(self):
		conn = self.loop.create_connection(lambda : MsgpackProtocol(self), self.host, self.port)
		coro = asyncio.ensure_future(conn)
		coro.add_done_callback(lambda future: 
							   asyncio.ensure_future(self.reconnect()) if future.exception() 
							   else None)
		
	def connection_made(self,protocol):
		self.connection = {
			"protocol": protocol,
			"promises": [],
			"ids": {},
			"callbacks": {}
		}

	def connection_lost(self,exc):
		self.connection = None
		asyncio.ensure_future(self.reconnect())
	
	async def reconnect(self):
		print("connection lost, reconnecting after timeout.")
		try:
			await asyncio.sleep(self.timeout)
			conn = self.loop.create_connection(lambda: MsgpackProtocol(self), self.host, self.port)
			coro = asyncio.ensure_future(conn)
			coro.add_done_callback(lambda future: 
								   asyncio.ensure_future(self.reconnect()) if future.exception() 
								   else print("piperdb client has reconnected", flush=True))
			
		except Exception as e:
			print(e)
		
	def data_received(self,decoded):
		if not isinstance(decoded, collections.Sequence) or isinstance(decoded, (str)):
			raise RuntimeError("expecting array")
		
		if not len(decoded):
			raise RuntimeError("expecting a non-empty array")

		if not isinstance(decoded[0], (int)):
			raise RuntimeError("expecting channel ID as a first element")

		channel = decoded.pop(0)

		if channel > 0:
			if not channel in self.connection["callbacks"]:
				raise RuntimeError("unknown channel {}".format(channel))
			for cb in self.connection["callbacks"][channel]:
				cb(transform(decoded[0]))
		else:
			if self.connection["promises"]:
				prom = self.connection["promises"].pop(0)
				ctrl_call = prom["resolve"] if channel == 0 else prom["reject"]
				ctrl_call(*[transform(x) for x in decoded])
			else:
				self.default_callback(*[transform(x) for x in decoded])

	def default_callback(self, *args):
		if args[0].startswith("Connection terminated"):
			print(args[0])
		else:
			raise RuntimeError(f"unexpected response {args}")

	def publish(self, key, value):
		if self.connection == None:
			return asyncio.ensure_future(raise_(RuntimeError("connection is down")))
		
		if key in self.connection["ids"]:
			id = self.connection["ids"][key]
			protocol = self.connection["protocol"]
			return asyncio.ensure_future(protocol.send_data_to_tcp([id, value]))
		
		fut = asyncio.Future()
		def _resolve(id):
			print("resolve pub "+str(id))
			self.connection["ids"][key] = id
			fut.set_result(None)

		async def pub_():	
			await self.connection["protocol"].send_data_to_tcp([0, 'pub', key, value])
			self.connection["promises"].append({
				"resolve": _resolve,
				"reject": (lambda error: fut.set_exception(Exception(error)))
			})

		asyncio.ensure_future(pub_())
		return fut

	def authentication(self, user, password):
		if self.connection == None:
			return asyncio.ensure_future(raise_(RuntimeError("connection is down")))

		fut = asyncio.Future()

		def _resolve(data):
			if 'User logged out' in data:
				for key, callback in self.subs:
					self.subscribe(key, callback)
			fut.set_result(data)

		async def auth_():
			await self.connection["protocol"].send_data_to_tcp([user, password])
			self.connection["promises"].append({
				"resolve": _resolve,
				"reject": (lambda error: fut.set_exception(Exception(error)))
			})

		asyncio.ensure_future(auth_())
		return fut

	def _callbacks(self, id):
		callbacks = self.connection["callbacks"]
		if not id in callbacks:
			callbacks[id] = []
		return callbacks[id]

	def subscribe(self, key, callback):
		if self.connection == None:
			return asyncio.ensure_future(raise_(RuntimeError("connection is down.")))
				
		fut = asyncio.Future()
		def _resolve(id, data):
			print("resolve sub " + str(id))
			self.connection["ids"][key] = id
			self._callbacks(id).append(callback)
			self.subs.add((key, callback))
			callback(data)
			fut.set_result(None)

		async def sub_():
			await self.connection["protocol"].send_data_to_tcp([0, 'sub', key])
			self.connection["promises"].append({
				"resolve": _resolve,
				"reject": (lambda error: fut.set_exception(Exception(error)))
			})
		
		asyncio.ensure_future(sub_())
		return fut
		
	def close(self):
		if self.connection:
			self.connection["protocol"].close

