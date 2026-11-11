#!/usr/bin/env bash
set -euo pipefail
printf 'Checking Solidity source and local Python/Ganache RPC...\n'
python scripts/check_rpc.py
printf '\nRun compilation: npm run compile\nRun tests: npm test\nRun local demo: npm run demo\n'
