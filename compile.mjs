import fs from 'node:fs';
import { compileContract } from './compiler.mjs';
const artifact = compileContract();
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/HotelBooking.json', JSON.stringify(artifact, null, 2) + '\n');
console.log(`SOLIDITY COMPILED: ${artifact.compiler} | EVM paris | ABI ${artifact.abi.length} entries`);
console.log('Artifact: artifacts/HotelBooking.json');
