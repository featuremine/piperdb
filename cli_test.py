from client import PiperClient
from aioconsole import ainput
import json
import asyncio
import argparse
import datetime
import os
import re
import readline
import pytz

class PiperCLI():

        def __init__(self, host, port, loop, timeout=5):
                self.loop = loop
                self.subs = {}
                self.pc = PiperClient(host, port, loop, timeout)
                self.pc.connect()
                if port==8124:
                        instance='AMER sim'
                elif port==8125:
                        instance='AMER uat'
                elif port==8126:
                        instance='AMER prod'
                elif port==8127:
                        instance='AMER blsim'
                elif port==8128:
                        instance='AMER bluat'
                elif port==8129:
                        instance='AMER blprod'
                elif port==8130:
                        instance='EMEA sim'
                elif port==8131:
                        instance='EMEA uat'
                elif port==8132:
                        instance='EMEA prod'
                else:
                        raise ValueError('Wrong port')
                print(instance+" - Connected at "+str(datetime.datetime.now()))
                self.loop.run_until_complete(self.main())

        async def main(self):

                if options.port==8124:
                        country='US'
                        acct='101'
                        jubilee='livesim'
                elif options.port==8125:
                        country='US'
                        account='101'
                        jubilee='liveuat'
                elif options.port==8126:
                        country='US'
                        account='101'
                        jubilee='live'
                elif options.port==8127:
                        country='US'
                        account='102'
                        jubilee='liveblsim'
                elif options.port==8128:
                        country='US'
                        account='102'
                        jubilee='livebluat'
                elif options.port==8129:
                        country='US'
                        account='102'
                        jubilee='livebl'
                elif ((options.port==8130)|(options.port==8131)|(options.port==8132)):
                        print("need to set up EU")
                else:
                        raise ValueError("Country not set up yet")

                date=datetime.date.strftime(datetime.datetime.now(pytz.timezone('EST')),'%Y%m%d')
                url='/data/data/staging/data/output/'+date+'/universe.json'
                with open(url) as fd:
                        universe = json.loads(fd.read())

                while True:
                        try:
                                line = await ainput()
                                cmd = line.split(" ")[0]
                                inp = line.split(" ")[1]
                                if ((cmd != 'pub') & (cmd !='sub')):
                                        raise ValueError('Wrong command: only accept pub/sub')
                                opts = [x for x in lst if x.startswith(inp)]
                                if len(opts) == 0:
                                        if inp.startswith("fsa"):
                                                ticker=inp.split(":")[1]
                                                if ticker in universe:
                                                        cmd, _, inp = line.strip().partition(" ")
                                                else:
                                                        raise ValueError('Wrong command: wrong ticker')
                                        elif inp.startswith("validation/instrument"):
                                                if inp.split("/")[2].split(":")[0] not in universe:
                                                        raise ValueError('Wrong command: wrong ticker')
                                                elif inp.split("/")[2].split(":")[1] !=account:
                                                        raise ValueError('Wrong command: wrong account for this port')
                                                elif ((inp.split("/")[2].split(":")[0] in universe) & (inp.split("/")[2].split(":")[1] ==account)):
                                                        inp=inp.replace(inp.split("/")[2],'ticker:acct')
                                                        opts = [x for x in lst if x.startswith(inp)]
                                                        if len(opts)!=0:
                                                                cmd, _, inp = line.strip().partition(" ")
                                                        else:
                                                                raise ValueError('Wrong command: out of acceptable keys')
                                                else:
                                                        raise ValueError('Wrong command: out of acceptable keys')
                                                        cmd, _, inp = line.strip().partition(" ")

                                        elif inp.startswith("validation/account"):
                                                if inp.split("/")[2]!=account:
                                                        raise ValueError('Wrong command: wrong account for this port')
                                                else:
                                                        inp=inp.replace(inp.split("/")[2],'acct')
                                                        opts = [x for x in lst if x.startswith(inp)]
                                                        if len(opts)!=0:
                                                                cmd, _, inp = line.strip().partition(" ")
                                                        else:
                                                                raise ValueError('Wrong command: out of acceptable keys')
                                        else:
                                                raise ValueError('Wrong command: out of acceptable keys')
                                                cmd, _, inp = line.strip().partition(" ")
                                elif len(opts) == 1:
                                        if ("pass_portexec.halted" in (inp)) | ("vwap_exec.halted" in (inp)) :
                                              cmd, _, inp = line.strip().partition(" ")
                                else:
                                        for index, name in enumerate(opts):
                                                print("{0}: {1}".format(index, name))
                                        index = input("Please enter key#: ")

                                        if opts[int(index)][-1:]==".":
                                                while True:
                                                        try:
                                                                ticker=input('Please provide ticker: ')
                                                                if ticker in(universe):
                                                                        break
                                                                print("ERROR: invalid response "+ticker+", out of universe")
                                                        except Exception as e:
                                                                print(e)
                                                if cmd=='pub':
                                                        value=input('Please provide value: ')
                                                        key=opts[int(index)]+country+":"+ticker+" "+value
                                                else:
                                                        key=opts[int(index)]+country+":"+ticker
                                        elif "validation" in opts[int(index)]:
                                                if "ticker" in opts[int(index)]:
                                                        while True:
                                                                try:
                                                                        ticker=input('Please provide ticker: ')
                                                                        if ticker in(universe):
                                                                                break
                                                                        print("ERROR: invalid response "+ticker+", out of universe")
                                                                except Exception as e:
                                                                        print(e)

                                                        key=opts[int(index)].replace('ticker',ticker)
                                                        key=key.replace('acct',account)
                                                        if cmd=='pub':
                                                                value=input('Please provide value: ')
                                                                key=key+" "+value
                                                else:
                                                        key=opts[int(index)].replace('acct',account)
                                                        if cmd=='pub':
                                                                value=input('Please provide value: ')
                                                                key=key+" "+value
                                        else:
                                                if cmd == 'sub':
                                                        key=opts[int(index)]
                                                else:
                                                        while True:
                                                                try:
                                                                        TF=input('Please provide true/false: ')
                                                                        answers=['true','false']
                                                                        if TF in(answers):
                                                                                break
                                                                        print("ERROR: invalid response "+TF+", only accept true/false")
                                                                except Exception as e:
                                                                        print(e)
                                                        key=opts[int(index)]+" "+TF
                                        final=cmd+" "+key
                                        cmd, _, inp = final.strip().partition(" ")

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

                                        print("_________________________________________________")
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

                                        print("_________________________________________________")
                                        self.pc.publish(key, obj).add_done_callback(pub_)
                                        print("sent pub request on key {0}".format(key), flush=True)
                                        continue

                                else:
                                        print("Wrong command. Try: pub, sub or close",flush=True)

                        except Exception as e:
                                print("An error occurred:",e.args[0], flush=True)


if __name__ == '__main__':

        parser = argparse.ArgumentParser()
        parser.add_argument('--host',default='link2')
        parser.add_argument('--port',required=True, type=int)
        options = parser.parse_args()

        lst = ["pass_portexec.halted",
               "vwap_exec.halted",
               "fsa_tgt.symbol_halted.",
               "fsa_exec.halted.",
               "fsa_tgt.position_limits.min_shares.",
               "fsa_tgt.position_limits.max_shares.",
               "fsa_tgt.position_limits.min_dollars.",
               "fsa_tgt.position_limits.max_dollars.",
               "validation/instrument:account/ticker:acct/count_throttle",
               "validation/instrument:account/ticker:acct/notional_throttle",
               "validation/instrument:account/ticker:acct/share_throttle",
               "validation/instrument:account/ticker:acct/total_notional_max",
               "validation/instrument:account/ticker:acct/total_volume_max",
               "validation/instrument:account/ticker:acct/open_count_max",
               "validation/instrument:account/ticker:acct/open_notional_max",
               "validation/instrument:account/ticker:acct/open_share_max",
               "validation/account/acct/count_throttle",
               "validation/account/acct/notional_throttle",
               "validation/account/acct/share_throttle",
               "validation/account/acct/total_position_max",
               "validation/account/acct/total_notional_max",
               "validation/account/acct/total_volume_max",
               "validation/account/acct/open_count_max",
               "validation/account/acct/open_notional_max",
               "validation/account/acct/open_share_max"]

        loop = asyncio.get_event_loop()
        try:
                client = PiperCLI(options.host,options.port,loop)
        except KeyboardInterrupt as e:
                print("Manually killed")
        loop.stop()
        loop.close()

