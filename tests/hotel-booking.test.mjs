import { test } from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { ethers } from 'ethers';
import { compileContract } from '../scripts/compiler.mjs';

const artifact = compileContract();

async function fixture(t) {
  const chain = ganache.provider({
    logging: { quiet: true },
    wallet: { totalAccounts: 3 },
    chain: { chainId: 1337, hardfork: 'shanghai' }
  });
  t.after(async () => { await chain.disconnect(); });
  const provider = new ethers.BrowserProvider(chain);
  const [hotel, guest, other] = await Promise.all([0, 1, 2].map(i => provider.getSigner(i)));
  const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, hotel)
    .deploy({ gasLimit: 1_000_000 });
  await contract.waitForDeployment();
  return { contract, hotel, guest, other };
}

async function mustRevert(action, expectedReason) {
  await assert.rejects(action, e => {
    const message = [e?.reason, e?.shortMessage, e?.info?.error?.message, e?.message]
      .filter(Boolean).join(' | ');
    assert.ok(message.includes(expectedReason),
      `Expected revert '${expectedReason}', received: ${message}`);
    return true;
  });
}

test('1. deploy: hotel recorded, guest empty, room Available', async t => {
  const { contract, hotel } = await fixture(t);
  assert.equal(await contract.hotel(), await hotel.getAddress());
  assert.equal(await contract.guest(), ethers.ZeroAddress);
  assert.equal(await contract.status(), 0n);
});

test('2. guest can book room: state Pending', async t => {
  const { contract, guest } = await fixture(t);
  await (await contract.connect(guest).bookRoom({ gasLimit: 200_000 })).wait();
  const [bookedGuest, status] = await contract.getBooking();
  assert.equal(bookedGuest, await guest.getAddress());
  assert.equal(status, 1n);
});

test('3. hotel confirms pending booking: state Confirmed', async t => {
  const { contract, guest } = await fixture(t);
  await (await contract.connect(guest).bookRoom({ gasLimit: 200_000 })).wait();
  assert.equal(await contract.status(), 1n);
  await (await contract.confirmBooking({ gasLimit: 200_000 })).wait();
  assert.equal(await contract.status(), 2n);
});

test('4. hotel cannot book its own room', async t => {
  const { contract } = await fixture(t);
  await mustRevert(() => contract.bookRoom.staticCall(), 'Hotel cannot book');
});

test('5. confirmation before booking rejected', async t => {
  const { contract } = await fixture(t);
  await mustRevert(() => contract.confirmBooking.staticCall(), 'No pending booking');
});

test('6. double booking rejected', async t => {
  const { contract, guest, other } = await fixture(t);
  await (await contract.connect(guest).bookRoom({ gasLimit: 200_000 })).wait();
  await mustRevert(() => contract.connect(other).bookRoom.staticCall(), 'Room unavailable');
});

test('7. non-hotel cannot confirm booking', async t => {
  const { contract, guest, other } = await fixture(t);
  await (await contract.connect(guest).bookRoom({ gasLimit: 200_000 })).wait();
  await mustRevert(() => contract.connect(other).confirmBooking.staticCall(), 'Only hotel can confirm');
});

test('8. cannot confirm twice or book after confirmation', async t => {
  const { contract, guest, other } = await fixture(t);
  await (await contract.connect(guest).bookRoom({ gasLimit: 200_000 })).wait();
  await (await contract.confirmBooking({ gasLimit: 200_000 })).wait();
  await mustRevert(() => contract.confirmBooking.staticCall(), 'No pending booking');
  await mustRevert(() => contract.connect(other).bookRoom.staticCall(), 'Room unavailable');
});
