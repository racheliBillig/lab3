const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const read = name => readFileSync(join(__dirname, '..', name), 'utf8');

function fixture() {
  const elements = Object.fromEntries(['opening', 'start', 'menu', 'restart', 'pause-overlay', 'pause-status'].map(id =>
    [id, { hidden: true, addEventListener(type, fn) { this[type] = fn; } }]));
  const keyboard = new EventEmitter();
  keyboard.createCursorKeys = () => Object.fromEntries(['up', 'down', 'left', 'right'].map(k => [k, { isDown: false }]));
  keyboard.addKeys = () => Object.fromEntries(['W', 'A', 'S', 'D', 'R'].map(k => [k, { isDown: false }]));
  keyboard.removeCapture = keyboard.resetKeys = () => {};
  const domEvents = new EventEmitter();
  const overlaps = [], timers = [], tweens = [];
  let scene, physicsPaused = true, scenePaused = false, seed = 123;
  function object(x = 0, y = 0) {
    const o = { x, y, visible: true, active: true,
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setVisible(value) { this.visible = value; return this; },
      setText(value) { this.text = value; return this; },
      setOrigin() { return this; }, setDisplaySize() { return this; },
      setAngle() { return this; }, setScale(value) { this.scale = value; return this; },
      destroy() { this.active = false; if (this.group) this.group.children = this.group.children.filter(c => c !== this); }
    };
    o.body = { enable: true, setSize() { return this; }, setOffset() { return this; },
      setCircle() { return this; }, setCollideWorldBounds() { return this; }, setBounce() { return this; },
      reset(x, y) { o.setPosition(x, y); }, setVelocity(x, y) { this.vx = x; this.vy = y; return this; } };
    return o;
  }
  const graphics = () => new Proxy(object(), { get(target, key) { return key in target ? target[key] : () => target; } });
  class Vector2 {
    constructor(x, y) { this.x = x; this.y = y; }
    normalize() { const length = Math.hypot(this.x, this.y) || 1; this.x /= length; this.y /= length; return this; }
    scale(n) { this.x *= n; this.y *= n; return this; }
  }
  const sandbox = {
    window: { addEventListener: (...args) => domEvents.on(...args), removeEventListener: (...args) => domEvents.off(...args) },
    document: { querySelectorAll: () => [], querySelector: () => ({ value: 'fox', focus() {} }),
      getElementById: id => { assert(elements[id], `Missing DOM element ${id}`); return elements[id]; }, activeElement: { blur() {} } },
    Phaser: { Scene: class {}, AUTO: 0, Scale: { FIT: 0, CENTER_HORIZONTALLY: 0 },
      Math: { Vector2, Between(min, max) { seed = (seed * 1664525 + 1013904223) >>> 0; return min + seed % (max - min + 1); },
        Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) } },
      Game: class { constructor() { this.scene = { getScene: () => scene, pause() { scenePaused = true; }, start() {} }; } }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(read('settings.js'), sandbox);
  sandbox.COIN_DASH = sandbox.window.COIN_DASH;
  vm.runInContext(read('game.js') + '\nwindow.TestScene = CoinDash;', sandbox);
  scene = new sandbox.window.TestScene();
  scene.events = new EventEmitter();
  scene.events.once = function(type, callback, context) {
    return EventEmitter.prototype.once.call(this, type, context ? callback.bind(context) : callback);
  };
  scene.physics = { resume() { physicsPaused = false; }, pause() { physicsPaused = true; },
    world: { setBounds() {} }, add: { existing() {},
      group() { return { children: [], add(o) { this.children.push(o); o.group = this; }, getChildren() { return this.children; }, countActive() { return this.children.filter(o => o.active).length; } }; },
      overlap(a, b, callback) { overlaps.push({ a, b, callback }); } } };
  scene.time = { now: 0, addEvent(config) { const timer = { ...config, remove() { this.removed = true; } }; timers.push(timer); return timer; },
    delayedCall(delay, callback) { return this.addEvent({ delay, callback }); }, removeAllEvents() { timers.forEach(t => t.remove()); } };
  scene.tweens = { add(config) { tweens.push(config); }, killTweensOf() {}, pauseAll() {} };
  scene.textures = { exists: () => true };
  scene.add = { circle: object, rectangle(x, y) { const o = object(x, y); o.setFillStyle = function(color) { this.color = color; return this; }; return o; },
    image(x, y) { const o = object(x, y); o.setTint = function(color) { this.tint = color; }; o.clearTint = function() { this.tint = null; }; return o; },
    text: object, graphics };
  scene.input = { keyboard };
  scene.scene = { pause() { scenePaused = true; }, resume() { scenePaused = false; } };
  elements.start.click();
  scene.create();
  return { scene, elements, overlaps, timers, tweens, keyboard, domEvents, config: sandbox.COIN_DASH,
    isPhysicsPaused: () => physicsPaused, isScenePaused: () => scenePaused,
    collect(target, ...args) { overlaps.find(overlap => overlap.b === target).callback(scene.player, ...args); } };
}

test('all merged pickups initialize and speed boost works with image explorers', () => {
  const f = fixture(), s = f.scene;
  assert.equal(s.coins.countActive(), 1);
  assert.equal(s.drones.getChildren().length, 3);
  assert.equal(f.isPhysicsPaused(), false);
  f.collect(s.coins, s.coins.getChildren()[0]);
  assert.equal(s.score, 1);
  assert.equal(s.coins.countActive(), 1);
  s.spawnSpeedCoin();
  assert(s.speedCoin.visible);
  f.collect(s.speedCoin);
  assert.equal(s.score, 2);
  assert.equal(s.speedCoin.visible, false);
  s.cursors.right.isDown = true;
  s.update();
  assert.equal(s.player.body.vx, f.config.playerSpeed * f.config.speedCoin.boostMultiplier);
  assert.equal(s.player.tint, f.config.colors.speedCoin);
  s.time.now = s.boostUntil + 1;
  s.update();
  assert.equal(s.player.body.vx, f.config.playerSpeed);
  assert.equal(s.player.tint, null);
});

test('timed coins spawn after ten seconds, count down, expire, and respect the cap', () => {
  const { scene: s, config } = fixture();
  s.time.now = 9999; s.updateTimedCoins(); assert.equal(s.coins.countActive(), 1);
  s.time.now = 10000; s.updateTimedCoins();
  const coin = s.coins.getChildren().find(c => c.expireAt);
  assert(coin.expireAt >= 13000 && coin.expireAt <= 14000);
  assert(['3', '4'].includes(coin.label.text));
  s.time.now = 11500; s.updateTimedCoins(); assert.equal(s.coins.countActive(), config.timedCoins.maxOnBoard);
  s.time.now = 13000; s.updateTimedCoins(); assert(s.coins.countActive() <= config.timedCoins.maxOnBoard);
  s.time.now = coin.expireAt; s.updateTimedCoins(); assert.equal(coin.active, false); assert.equal(coin.label.active, false);
});

test('pause preserves round duration, boost, timed phase, spawns, and coin expiration', () => {
  const { scene: s, isScenePaused } = fixture();
  s.time.now = 10000; s.updateTimedCoins(); s.boostUntil = 15000;
  const coin = s.coins.getChildren().find(c => c.expireAt);
  const before = { deadline: s.deadline, startTime: s.startTime, spawn: s.nextSpawnAt, expiry: coin.expireAt };
  s.togglePause(); assert(isScenePaused());
  s.togglePause(); assert.equal(isScenePaused(), false);
  s.time.now = 70000; s.events.emit('preupdate', 70000);
  assert.equal(s.deadline, before.deadline + 60000);
  assert.equal(s.startTime, before.startTime + 60000);
  assert.equal(s.nextSpawnAt, before.spawn + 60000);
  assert.equal(coin.expireAt, before.expiry + 60000);
  assert.equal(s.boostUntil, 75000);
  s.update(); assert.equal(s.finished, false); assert.equal(coin.active, true);
});

test('hazard enrages drones to triple size, then restores them', () => {
  const f = fixture(), s = f.scene;
  f.collect(s.hazard);
  assert(s.enraged); assert.equal(s.hazard.visible, false);
  const grow = f.tweens.find(t => t.scale === 3); assert(grow);
  assert(s.drones.getChildren().every(d => d.color === f.config.colors.droneEnraged));
  grow.onComplete(); assert(f.tweens.some(t => t.scale > 3));
  s.calmDrones(); assert.equal(s.enraged, false);
  assert(s.drones.getChildren().every(d => d.scale === 1 && d.color === f.config.colors.drone));
});

test('restart and repeated rounds reset state and remove old keyboard listeners', () => {
  const f = fixture(), s = f.scene;
  s.finish('Test'); assert(f.isPhysicsPaused());
  assert(f.timers.every(t => t.removed));
  f.elements.restart.click(); assert.equal(f.elements.opening.hidden, false);
  assert.equal(f.elements.restart.hidden, true);
  for (let i = 0; i < 3; i++) {
    s.events.emit('shutdown');
    assert.equal(f.keyboard.listenerCount('keydown-R'), 0);
    assert.equal(f.domEvents.listenerCount('keydown'), 0);
    f.elements.start.click(); s.create();
    assert.equal(s.score, 0); assert.equal(s.finished, false); assert.equal(s.paused, false);
    assert.equal(f.isPhysicsPaused(), false);
    assert.equal(f.keyboard.listenerCount('keydown-R'), 1);
    assert.equal(f.domEvents.listenerCount('keydown'), 1);
  }
});
