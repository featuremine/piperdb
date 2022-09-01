import asyncio
import msgpack

class MsgpackProtocol(asyncio.Protocol):
	def __init__(self, client):
		self.transport = None
		self.client = client
		
	def connection_made(self, transport):
		self.transport = transport
		self.unpacker = msgpack.Unpacker(raw=True)
		self.client.connection_made(self)
	
	def connection_lost(self, exc):
		self.unpacker = None
		self.client.connection_lost(exc)
		
	def data_received(self, data):
		self.unpacker.feed(data)
		while True:
			try:
				decoded = self.unpacker.unpack()
			except msgpack.OutOfData:
				# Out of data
				break
			self.client.data_received(decoded)			
		
	async def send_data_to_tcp(self,data):
		encoded = msgpack.packb(data)
		return self.transport.write(encoded)
		
	def close(self):
		if self.transport is not None:
			self.transport.close()
			self.transport = None
