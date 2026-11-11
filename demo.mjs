import fs from 'node:fs';
import ganache from 'ganache';
import { ethers } from 'ethers';
import { compileContract } from './compiler.mjs';

// Use a fresh in-memory chain each run.
const chain = ganache.provider({
  logging: { quiet: true },
  wallet: { totalAccounts: 3 },
  chain: { chainId: 1337, hardfork: 'shanghai' }
});

function errorText(e) {
  return [e?.reason, e?.shortMessage, e?.revert?.args?.[0],
          e?.info?.error?.message, e?.message].filter(Boolean).join(' | ');
}

try {
  const provider = new ethers.BrowserProvider(chain);
  const [hotelSigner, guestSigner, strangerSigner] = await Promise.all(
    [0, 1, 2].map(i => provider.getSigner(i))
  );
  const artifact = compileContract();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, hotelSigner);
  const c = await factory.deploy({ gasLimit: 1_000_000 });
  await c.waitForDeployment();
  const contractAddress = await c.getAddress();
  const deploymentReceipt = await c.deploymentTransaction().wait();
  const hotelAddress = await hotelSigner.getAddress();
  const guestAddress = await guestSigner.getAddress();
  const strangerAddress = await strangerSigner.getAddress();

  const results = {
    tool: 'Ganache in-memory Ethereum test chain',
    note: 'Real local execution of this script, not a Remix or public Ethereum transaction',
    compiler: artifact.compiler,
    evmVersion: 'paris',
    networkChainId: 1337,
    contractAddress,
    deploymentHash: deploymentReceipt.hash,
    hotel: hotelAddress,
    guest: guestAddress,
    unauthorizedAccount: strangerAddress,
    checks: []
  };
  const addPass = (test, extra = {}) => {
    results.checks.push({ test, result: 'PASS', ...extra });
    console.log('PASS ' + test);
  };
  const checkState = async (expectedGuest, expectedStatus, label) => {
    const [currentGuest, currentStatus] = await c.getBooking();
    if (currentGuest.toLowerCase() !== expectedGuest.toLowerCase() || currentStatus !== expectedStatus) {
      throw new Error(`${label}: expected (${expectedGuest}, ${expectedStatus}) but received (${currentGuest}, ${currentStatus})`);
    }
  };
  // eth_call/staticCall is used for *expected* reverts. It avoids gas-estimation
  // failures being mistaken for a crashed test; no blockchain state is changed.
  const expectRevert = async (label, caller, method, expectedReason) => {
    let rejection;
    try {
      await c.connect(caller).getFunction(method).staticCall();
    } catch (e) {
      rejection = errorText(e);
    }
    if (!rejection) throw new Error(`${label}: unexpectedly succeeded`);
    if (!rejection.includes(expectedReason)) {
      throw new Error(`${label}: expected '${expectedReason}', got '${rejection}'`);
    }
    addPass(label, { rejection: expectedReason, method: 'eth_call (no on-chain transaction)' });
  };

  console.log('CONTRACT ' + contractAddress);
  console.log('DEPLOY   ' + deploymentReceipt.hash);
  await checkState(ethers.ZeroAddress, 0n, 'Initial state');
  addPass('Initial status Available; guest empty');
  await expectRevert('Hotel cannot confirm before a booking', hotelSigner, 'confirmBooking', 'No pending booking');

  console.log('STAGE    Guest submits booking...');
  const bookingReceipt = await (await c.connect(guestSigner).bookRoom({ gasLimit: 200_000 })).wait();
  if (bookingReceipt.status !== 1) throw new Error('Booking transaction failed');
  await checkState(guestAddress, 1n, 'After bookRoom');
  addPass('Guest creates Pending booking', { txHash: bookingReceipt.hash, blockNumber: bookingReceipt.blockNumber });

  await expectRevert('Second guest cannot double book', strangerSigner, 'bookRoom', 'Room unavailable');
  await expectRevert('Guest cannot confirm as hotel', guestSigner, 'confirmBooking', 'Only hotel can confirm');
  console.log('STAGE    Hotel confirms booking...');
  const confirmationReceipt = await (await c.connect(hotelSigner).confirmBooking({ gasLimit: 200_000 })).wait();
  if (confirmationReceipt.status !== 1) throw new Error('Confirmation transaction failed');
  await checkState(guestAddress, 2n, 'After confirmBooking');
  addPass('Hotel confirms Pending booking', { txHash: confirmationReceipt.hash, blockNumber: confirmationReceipt.blockNumber });

  await expectRevert('Second confirmation rejected', hotelSigner, 'confirmBooking', 'No pending booking');
  await expectRevert('Cannot book already confirmed room', strangerSigner, 'bookRoom', 'Room unavailable');

  if (results.checks.length !== 8 || results.checks.some(x => x.result !== 'PASS')) {
    throw new Error('Demo checks did not all pass');
  }
  fs.mkdirSync('evidence', { recursive: true });
  fs.writeFileSync('evidence/local-demo-results.json', JSON.stringify(results, null, 2) + '\n');
  console.log('ALL 8 DEMO CHECKS PASSED');
  console.log('Actual execution evidence: evidence/local-demo-results.json');
} catch (e) {
  console.error('DEMO FAILED: ' + errorText(e));
  process.exitCode = 1;
} finally {
  await chain.disconnect();
}
