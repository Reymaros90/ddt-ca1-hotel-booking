import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

export function compileContract() {
  const sourcePath = path.resolve('contracts/HotelBooking.sol');
  const input = {
    language: 'Solidity',
    sources: { 'HotelBooking.sol': { content: fs.readFileSync(sourcePath, 'utf8') } },
    settings: {
      optimizer: { enabled: false },
      evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter(e => e.severity === 'error');
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  const contract = output.contracts?.['HotelBooking.sol']?.HotelBooking;
  if (!contract?.evm?.bytecode?.object) throw new Error('No bytecode generated');
  return { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}`, compiler: solc.version() };
}
