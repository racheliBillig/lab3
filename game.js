/* global Phaser, COIN_DASH */
// Shared canvas artwork keeps menu previews and in-game figures identical.
function drawExplorer(ctx, kind) {
  const box = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const circle = (x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  circle(32, 57, 19, '#00000033');
  if (kind === 'fox') {
    box(21, 34, 22, 18, '#e98542');
    box(20, 49, 9, 9, '#e98542'); box(36, 49, 9, 9, '#e98542');
    ctx.fillStyle = '#e98542'; ctx.beginPath();
    ctx.moveTo(13, 12); ctx.lineTo(27, 20); ctx.lineTo(39, 20); ctx.lineTo(51, 12);
    ctx.lineTo(48, 38); ctx.lineTo(32, 47); ctx.lineTo(16, 38); ctx.closePath(); ctx.fill();
    box(22, 30, 5, 5, '#142136'); box(38, 30, 5, 5, '#142136');
    box(27, 38, 11, 6, '#ffebce'); box(22, 44, 22, 5, '#96e4bd');
  } else if (kind === 'robot') {
    box(29, 7, 5, 8, '#a9b8e4'); circle(31, 7, 4, '#ffd166');
    box(14, 17, 36, 25, '#a9b8e4'); box(19, 22, 26, 14, '#17283f');
    box(23, 26, 6, 5, '#96e4bd'); box(36, 26, 6, 5, '#96e4bd');
    box(21, 44, 22, 11, '#8599cc'); box(10, 43, 8, 11, '#a9b8e4'); box(46, 43, 8, 11, '#a9b8e4');
    box(22, 55, 8, 5, '#a9b8e4'); box(35, 55, 8, 5, '#a9b8e4');
  } else {
    box(12, 32, 40, 17, '#96a8bd'); box(21, 35, 23, 19, '#edf2fa');
    box(20, 51, 9, 9, '#edf2fa'); box(36, 51, 9, 9, '#edf2fa');
    circle(32, 26, 20, '#edf2fa'); circle(32, 26, 15, '#253b58');
    box(22, 18, 10, 5, '#729cb9'); box(25, 43, 14, 5, '#ffd166');
  }
}

document.querySelectorAll('[data-character]').forEach(canvas => drawExplorer(canvas.getContext('2d'), canvas.dataset.character));
let selectedCharacter = 'scout';
let menuOpen = true;

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.paused = false;
    document.getElementById('pause-overlay').hidden = true;
    this.physics.resume();
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.drawBackground();
    this.add.rectangle(c.width / 2, 22, c.width, 44, 0x081222, 0.9);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    const textureKey = `explorer-${selectedCharacter}`;
    if (!this.textures.exists(textureKey)) {
      const texture = this.textures.createCanvas(textureKey, 64, 64);
      drawExplorer(texture.context, selectedCharacter);
      texture.refresh();
    }
    this.player = this.add.image(c.width / 2, c.height / 2, textureKey).setDisplaySize(40, 40);
    this.physics.add.existing(this.player);
    this.player.body.setSize(36, 46).setOffset(14, 12).setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.enraged = false;
    this.hazard = this.add.rectangle(0, 0, 18, 18, c.colors.hazard).setAngle(45);
    this.physics.add.existing(this.hazard);
    this.placeHazard();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.hazard, () => {
      if (this.finished || this.enraged) return;
      this.enrageDrones();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', openMenu);
    this.input.keyboard.on('keydown-ESC', openMenu);
    // A DOM listener still receives P while the Phaser scene is paused.
    const pauseKey = event => {
      if (event.code !== 'KeyP' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (menuOpen || this.finished) return;
      event.preventDefault();
      this.togglePause();
    };
    window.addEventListener('keydown', pauseKey);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', pauseKey);
      this.input.keyboard.off('keydown-R', openMenu);
      this.input.keyboard.off('keydown-ESC', openMenu);
      this.events.off('preupdate', this.resumeCountdown, this);
    });
    this.input.keyboard.enabled = !menuOpen;
    if (menuOpen) {
      this.input.keyboard.removeCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);
      this.scene.pause();
    }
  }

  togglePause() {
    this.paused = !this.paused;
    document.getElementById('pause-overlay').hidden = !this.paused;
    document.getElementById('pause-status').textContent = this.paused
      ? 'Paused · Press P to resume' : 'Pause / resume: P';
    if (this.paused) {
      this.remainingTime = this.deadline - this.time.now;
      this.scene.pause();
    } else {
      // The scene clock jumps to the current game time on the first resumed
      // frame. Use that frame’s timestamp to preserve the remaining duration.
      this.events.once('preupdate', this.resumeCountdown, this);
      this.input.keyboard.resetKeys();
      this.player.body.setVelocity(0, 0);
      this.scene.resume();
    }
  }

  resumeCountdown(time) {
    this.deadline = time + this.remainingTime;
  }

  drawBackground() {
    const c = COIN_DASH;
    const g = this.add.graphics();
    g.setScale(c.width / 800, c.height / 500);
    g.fillStyle(c.colors.background); g.fillRect(0, 0, 800, 500);
    g.fillStyle(0x192744, 0.65); g.fillCircle(680, 155, 190);
    g.fillStyle(0x253551, 0.7); g.fillCircle(680, 155, 110);
    g.fillStyle(0x17243c); g.fillCircle(710, 132, 100);
    for (let i = 0; i < 85; i++) {
      g.fillStyle(i % 4 === 0 ? 0xffd166 : 0x8198bc, 0.35 + (i % 3) * 0.2);
      g.fillCircle((i * 137 + 23) % 800, 50 + (i * 79) % 440, i % 4 === 0 ? 2 : 1);
    }
    g.fillStyle(0x0b1529); g.beginPath(); g.moveTo(0, 460);
    for (let x = 0; x <= 800; x += 40) g.lineTo(x, 460 - Math.sin(x * 0.02) * 12);
    g.lineTo(800, 500); g.lineTo(0, 500); g.closePath(); g.fillPath();
  }

  randomSpot() {
    const c = COIN_DASH;
    // Avoid spawning pickups directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    return { x, y };
  }

  placeCoin() {
    const { x, y } = this.randomSpot();
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  placeHazard() {
    const { x, y } = this.randomSpot();
    this.hazard.setPosition(x, y).setVisible(true);
    this.hazard.body.enable = true;
    this.hazard.body.reset(x, y);
  }

  enrageDrones() {
    const c = COIN_DASH;
    this.enraged = true;
    this.hazard.setVisible(false);
    this.hazard.body.enable = false;
    const drones = this.drones.getChildren();
    drones.forEach(drone => drone.setFillStyle(c.colors.droneEnraged));
    // Grow (the arcade bodies follow the scale), then keep pulsing around the enlarged size.
    this.tweens.add({
      targets: drones, scale: c.rageScale, duration: 200,
      onComplete: () => this.tweens.add({
        targets: drones, scale: c.rageScale * (1 + c.ragePulse),
        duration: 250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      })
    });
    let flash = false;
    this.rageFlash = this.time.addEvent({
      delay: 125, loop: true, callback: () => {
        flash = !flash;
        const color = flash ? c.colors.droneEnragedFlash : c.colors.droneEnraged;
        drones.forEach(drone => drone.setFillStyle(color));
      }
    });
    this.time.delayedCall(c.rageSeconds * 1000, () => this.calmDrones());
  }

  calmDrones() {
    const c = COIN_DASH;
    this.rageFlash.remove();
    const drones = this.drones.getChildren();
    this.tweens.killTweensOf(drones);
    drones.forEach(drone => drone.setScale(1).setFillStyle(c.colors.drone));
    this.enraged = false;
    this.time.delayedCall(c.hazardRespawnSeconds * 1000, () => this.placeHazard());
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    // Freeze any rage effect behind the overlay instead of letting it play out.
    this.time.removeAllEvents();
    this.tweens.pauseAll();
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nR / Esc: back to opening screen`,
      { font: '20px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});

function openMenu() {
  menuOpen = true;
  document.getElementById('pause-overlay').hidden = true;
  document.getElementById('pause-status').textContent = 'Pause / resume: P';
  const keyboard = window.coinDashGame.scene.getScene('CoinDash').input.keyboard;
  keyboard.enabled = false;
  keyboard.removeCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);
  window.coinDashGame.scene.pause('CoinDash');
  document.getElementById('opening').hidden = false;
  document.getElementById('menu').hidden = true;
  document.getElementById('restart').hidden = true;
  document.querySelector('input[name="character"]:checked').focus();
}

document.getElementById('start').addEventListener('click', () => {
  selectedCharacter = document.querySelector('input[name="character"]:checked').value;
  menuOpen = false;
  document.getElementById('opening').hidden = true;
  document.getElementById('menu').hidden = false;
  document.getElementById('restart').hidden = false;
  window.coinDashGame.scene.start('CoinDash');
  document.activeElement.blur();
});
document.getElementById('menu').addEventListener('click', openMenu);

document.getElementById('restart').addEventListener('click', openMenu);
