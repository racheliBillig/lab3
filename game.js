/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.createSpeedCoin();
    this.placeCoin();
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
    this.physics.add.overlap(this.player, this.speedCoin, () => {
      if (this.finished || !this.speedCoin.visible) return;
      this.score++;
      this.boostUntil = this.time.now + c.speedCoin.boostSeconds * 1000;
      this.hideSpeedCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
  }

  createSpeedCoin() {
    const c = COIN_DASH;
    this.boostUntil = 0;
    this.speedCoinExpiry = null;
    this.speedGlow = this.add.circle(0, 0, 16, c.colors.speedCoin, 0.35);
    this.speedCoin = this.add.circle(0, 0, 10, c.colors.speedCoin);
    this.physics.add.existing(this.speedCoin);
    this.speedCoin.body.setCircle(10);
    // Lightning bolt drawn around (0, 0) so it can simply be moved onto the coin.
    this.speedBolt = this.add.graphics();
    this.speedBolt.fillStyle(0x0a1120, 1);
    this.speedBolt.fillPoints([
      { x: 2, y: -8 }, { x: -5, y: 1 }, { x: 0, y: 1 },
      { x: -2, y: 8 }, { x: 5, y: -1 }, { x: 0, y: -1 }
    ], true);
    this.tweens.add({
      targets: this.speedGlow, scale: 1.35, alpha: 0.1, duration: 450, yoyo: true, repeat: -1
    });
    this.hideSpeedCoin();
    this.time.addEvent({
      delay: c.speedCoin.spawnEverySeconds * 1000, loop: true, callback: () => this.spawnSpeedCoin()
    });
  }

  spawnSpeedCoin() {
    if (this.finished || this.speedCoin.visible) return;
    const { x, y } = this.randomSpot([this.player, this.coin]);
    for (const part of [this.speedGlow, this.speedCoin, this.speedBolt]) {
      part.setPosition(x, y).setVisible(true);
    }
    this.speedCoin.body.reset(x, y);
    this.speedCoin.body.enable = true;
    this.speedCoinExpiry = this.time.delayedCall(
      COIN_DASH.speedCoin.lifetimeSeconds * 1000, () => this.hideSpeedCoin());
  }

  hideSpeedCoin() {
    for (const part of [this.speedGlow, this.speedCoin, this.speedBolt]) part.setVisible(false);
    this.speedCoin.body.enable = false;
    if (this.speedCoinExpiry) this.speedCoinExpiry.remove();
    this.speedCoinExpiry = null;
  }

  // Pick a spot that is not directly underneath any of the given objects.
  randomSpot(avoid) {
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (avoid.some(o => Phaser.Math.Distance.Between(x, y, o.x, o.y) < 60));
    return { x, y };
  }

  placeCoin() {
    const avoid = this.speedCoin.visible ? [this.player, this.speedCoin] : [this.player];
    const { x, y } = this.randomSpot(avoid);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const c = COIN_DASH;
    const boostLeft = this.boostUntil - this.time.now;
    const boosted = boostLeft > 0;
    const speed = c.playerSpeed * (boosted ? c.speedCoin.boostMultiplier : 1);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(speed);
    this.player.body.setVelocity(direction.x, direction.y);
    this.player.setFillStyle(boosted ? c.colors.speedCoin : c.colors.player);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const boostText = boosted ? `   ⚡ ${Math.ceil(boostLeft / 1000)}s` : '';
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s${boostText}`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
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
