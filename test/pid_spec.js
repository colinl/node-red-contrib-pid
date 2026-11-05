// Tests for the PID node. Zero dependencies: pid.js is loaded with a stub RED
// object and driven directly, with Date.now stubbed so time can be advanced.
// Run with:  node test/pid_spec.js
'use strict';
const assert = require('assert');
const path = require('path');

const realNow = Date.now;
let now = Date.parse('2024-01-01T00:00:00Z');
Date.now = () => now;
const advance = (seconds) => { now += seconds * 1000; };

let Ctor = null;
const RED = { nodes: {
  createNode: (node) => {
    node._handlers = {};
    node.on = (event, fn) => { node._handlers[event] = fn; };
    node.send = (msg) => { node._sent = msg; };
    node.status = () => {};
    node.log = () => {}; node.warn = () => {}; node.error = () => {};
  },
  registerType: (name, ctor) => { Ctor = ctor; }
}};
require(path.join(__dirname, '..', 'pid.js'))(RED);
assert.ok(Ctor, 'node did not register');

const defaults = { setpoint: 20, enable: 1, pb: '6', ti: '5000', td: '0',
                   smooth_factor: '2', max_interval: '600', disabled_op: 0,
                   integral_default: '0.5' };
function newNode(over) { return new Ctor(Object.assign({}, defaults, over)); }
function input(node, msg) { node._handlers.input(msg); return node._sent; }

let passed = 0;
function test(name, fn) {
  now = Date.parse('2024-01-01T00:00:00Z');
  try { fn(); passed++; console.log('ok   - ' + name); }
  catch (err) { console.log('FAIL - ' + name + '\n       ' + err.message); process.exitCode = 1; }
}

// ---- existing behaviour -------------------------------------------------

test('output is 0.5 when the process value is at the setpoint', () => {
  const n = newNode(); advance(1);
  assert.strictEqual(input(n, { payload: 20 }).payload, 0.5);
});

test('a colder process value raises the output', () => {
  const n = newNode(); advance(1);
  const warm = input(n, { payload: 20 }).payload;
  advance(15);
  assert.ok(input(n, { payload: 18 }).payload > warm);
});

test('integral_default sets the initial output', () => {
  const n = newNode({ integral_default: '0.25' }); advance(1);
  assert.strictEqual(input(n, { payload: 20 }).payload, 0.25);
});

// ---- setting the integral ------------------------------------------------

test('msg.topic "integral" sets the integral', () => {
  const n = newNode(); advance(1); input(n, { payload: 20 });
  input(n, { topic: 'integral', payload: 2 });
  advance(15);
  assert.strictEqual(input(n, { payload: 20 }).integral, 2);
});

test('msg.integral sets the integral alongside a process value', () => {
  const n = newNode(); advance(1); input(n, { payload: 20 });
  advance(15);
  assert.strictEqual(input(n, { payload: 20, integral: -1.5 }).integral, -1.5);
});

test('the integral is clamped to +/- prop_band/2', () => {
  const n = newNode(); advance(1); input(n, { payload: 20 });
  input(n, { topic: 'integral', payload: 99 });
  advance(15);
  assert.strictEqual(input(n, { payload: 20 }).integral, 3);
  input(n, { topic: 'integral', payload: -99 });
  advance(15);
  assert.strictEqual(input(n, { payload: 20 }).integral, -3);
});

test('a non-numeric integral is ignored', () => {
  const n = newNode(); advance(1); input(n, { payload: 20 });
  input(n, { topic: 'integral', payload: 'not a number' });
  advance(15);
  assert.strictEqual(input(n, { payload: 20 }).integral, 0);
});

test('an integral set before the first process value replaces integral_default', () => {
  const n = newNode({ integral_default: '0.5' });
  input(n, { topic: 'integral', payload: -2 });
  advance(15);
  const out = input(n, { payload: 20 });
  assert.strictEqual(out.integral, -2);
  assert.ok(Math.abs(out.payload - 0.8333) < 0.001, 'output ' + out.payload);
});

test('integral_default still applies when no integral is supplied', () => {
  const n = newNode({ integral_default: '0.5' }); advance(1);
  assert.strictEqual(input(n, { payload: 20 }).integral, 0);
});

test('the reported integral can be fed back in unchanged', () => {
  const a = newNode(); advance(1); input(a, { payload: 19 });
  for (let i = 0; i < 40; i++) { advance(15); input(a, { payload: 19 }); }
  const saved = a._sent.integral;
  assert.ok(saved !== 0, 'integral did not move');
  const b = newNode();
  input(b, { topic: 'integral', payload: saved });
  advance(15);
  assert.ok(Math.abs(input(b, { payload: 19 }).integral - saved) < 0.001);
});

Date.now = realNow;
console.log('\n' + passed + ' passing');
