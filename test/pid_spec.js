/**
 * Tests for the PID node.
 *
 * Run with: npm test
 *
 * The node is loaded into a Node-RED runtime by node-red-node-test-helper and
 * wired to a "helper" node, which captures the messages the PID node sends.
 */
'use strict';

const should = require('should');
const helper = require('node-red-node-test-helper');
const pidNode = require('../pid.js');

helper.init(require.resolve('node-red'));

// pid.js timestamps each sample with Date.now() and discards a sample that
// arrives with a delta_t of zero, so two messages sent in the same millisecond
// would not both be processed. The tests therefore replace the clock with one
// that moves only when advance() is called.
const realNow = Date.now;
const START = Date.parse('2024-01-01T00:00:00Z');
let now = START;

function advance(seconds) {
  now += seconds * 1000;
}

const defaults = {
  setpoint: 20,
  enable: 1,
  pb: '6',
  ti: '5000',
  td: '0',
  smooth_factor: '2',
  max_interval: '600',
  disabled_op: 0,
  integral_default: '0.5'
};

// Load the PID node with the given config overrides, wired to a helper node.
// Returns a handle used by sample() and setParam() below.
async function loadLoop(overrides) {
  // No property value here may equal a node id. A flow given to the helper has
  // no x/y coordinates, so the runtime treats its nodes as config nodes, and it
  // resolves config dependencies by matching property values against node ids.
  // A node carrying name: 'loop' alongside id: 'loop' would reference itself and
  // the flow would fail to start with a circular dependency error.
  const flow = [
    Object.assign({ id: 'loop', type: 'PID', wires: [['out']] },
                  defaults, overrides),
    { id: 'out', type: 'helper' }
  ];
  await helper.load(pidNode, flow);

  const loop = { pid: helper.getNode('loop'), queue: [], waiting: null };
  // Registered once for the lifetime of the flow. Node-RED holds a single input
  // callback per node rather than a list of listeners, so re-registering this
  // for each message would not be reliable.
  helper.getNode('out').on('input', function (msg) {
    if (loop.waiting) {
      const resolve = loop.waiting;
      loop.waiting = null;
      resolve(msg);
    } else {
      loop.queue.push(msg);
    }
  });

  now = START;
  Date.now = function () { return now; };
  return loop;
}

// Send a process value, resolving with the message the node sends in response.
function sample(loop, value, extra) {
  const sent = new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      reject(new Error('the node sent no message'));
    }, 1000);
    loop.waiting = function (msg) {
      clearTimeout(timer);
      resolve(msg);
    };
  });
  loop.pid.receive(Object.assign({ payload: value }, extra));
  return sent;
}

// Send a parameter message. None of the parameters used here produce output.
function setParam(loop, topic, value) {
  loop.pid.receive({ topic: topic, payload: value });
  return new Promise(function (resolve) {
    setImmediate(resolve);
  }).then(function () {
    loop.queue.should.be.empty();
  });
}

describe('PID node', function () {

  // The runtime is started once for the file; each test unloads its own flow.
  before(function (done) {
    helper.startServer(done);
  });

  after(function (done) {
    helper.stopServer(done);
  });

  afterEach(function () {
    Date.now = realNow;
    return helper.unload();
  });

  it('gives half power when the process value is at the setpoint', async function () {
    const loop = await loadLoop();
    const out = await sample(loop, 20);
    out.payload.should.equal(0.5);
  });

  it('raises the power when the process value is below the setpoint', async function () {
    const loop = await loadLoop();
    const atSetpoint = await sample(loop, 20);
    advance(15);
    const below = await sample(loop, 18);
    below.payload.should.be.above(atSetpoint.payload);
  });

  it('starts at the power given by integral_default', async function () {
    const loop = await loadLoop({ integral_default: '0.25' });
    const out = await sample(loop, 20);
    out.payload.should.equal(0.25);
  });

  describe('setting the integral', function () {

    it('accepts a msg.topic of "integral"', async function () {
      const loop = await loadLoop();
      await sample(loop, 20);
      await setParam(loop, 'integral', 2);
      advance(15);
      const out = await sample(loop, 20);
      out.integral.should.equal(2);
    });

    it('accepts msg.integral alongside a process value', async function () {
      const loop = await loadLoop();
      await sample(loop, 20);
      advance(15);
      const out = await sample(loop, 20, { integral: -1.5 });
      out.integral.should.equal(-1.5);
    });

    it('clamps the value to plus or minus half the proportional band', async function () {
      const loop = await loadLoop();
      await sample(loop, 20);

      await setParam(loop, 'integral', 99);
      advance(15);
      (await sample(loop, 20)).integral.should.equal(3);

      await setParam(loop, 'integral', -99);
      advance(15);
      (await sample(loop, 20)).integral.should.equal(-3);
    });

    it('ignores a value that is not a number', async function () {
      const loop = await loadLoop();
      await sample(loop, 20);
      await setParam(loop, 'integral', 'not a number');
      advance(15);
      const out = await sample(loop, 20);
      out.integral.should.equal(0);
    });

    it('replaces integral_default when set before the first process value', async function () {
      const loop = await loadLoop({ integral_default: '0.5' });
      await setParam(loop, 'integral', -2);
      advance(15);
      const out = await sample(loop, 20);
      out.integral.should.equal(-2);
      out.payload.should.be.approximately(0.8333, 0.001);
    });

    it('leaves integral_default in place when no integral is supplied', async function () {
      const loop = await loadLoop({ integral_default: '0.5' });
      const out = await sample(loop, 20);
      out.integral.should.equal(0);
    });

    it('accepts the integral it reported earlier, unchanged', async function () {
      const first = await loadLoop();
      await sample(first, 19);
      let reported;
      for (let i = 0; i < 40; i++) {
        advance(15);
        reported = (await sample(first, 19)).integral;
      }
      reported.should.not.equal(0);

      // A fresh node given that value reports it back on its first sample.
      await helper.unload();
      const second = await loadLoop();
      await setParam(second, 'integral', reported);
      advance(15);
      const out = await sample(second, 19);
      out.integral.should.be.approximately(reported, 0.001);
    });
  });
});
