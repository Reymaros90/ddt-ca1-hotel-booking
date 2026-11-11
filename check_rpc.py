#!/usr/bin/env python3
"""Read-only health check for a locally running Ganache JSON-RPC server."""
import json
import sys
from urllib import request, error

URL = 'http://127.0.0.1:8545'
def rpc(method, params=None):
    payload = json.dumps({'jsonrpc':'2.0','method':method,'params':params or [],'id':1}).encode()
    req = request.Request(URL, data=payload, headers={'Content-Type':'application/json'})
    with request.urlopen(req, timeout=5) as response:
        result = json.load(response)
    if 'error' in result:
        raise RuntimeError(result['error'])
    return result['result']
try:
    network_id = int(rpc('eth_chainId'), 16)
    block = int(rpc('eth_blockNumber'), 16)
    accounts = rpc('eth_accounts')
    print(f'Ganache RPC OK: {URL}')
    print(f'Chain ID: {network_id}, block: {block}, accounts: {len(accounts)}')
except (error.URLError, OSError, ValueError, RuntimeError) as exc:
    print('Ganache RPC not available. Start Ganache GUI or run: npm run ganache')
    print(f'Detail: {exc}')
    sys.exit(1)
