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
    this.startTime = this.time.now;
    this.nextSpawnAt = 0;
    this.coins = this.physics.add.group();
    this.spawnCoin(false);
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coins, (player, coin) => {
      if (this.finished || !coin.active) return;
      this.score++;
      this.removeCoin(coin);
      // Before timed coins start, keep a single permanent coin on the board.
      if (!this.timedPhase()) this.spawnCoin(false);
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
  }

  timedPhase() {
    return this.time.now - this.startTime >= COIN_DASH.timedCoins.startAfterSeconds * 1000;
  }

  pickCoinPosition() {
    const c = COIN_DASH;
    // Avoid spawning a coin directly underneath the player or on top of another coin.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60
      || this.coins.getChildren().some(coin => Phaser.Math.Distance.Between(x, y, coin.x, coin.y) < 40));
    return { x, y };
  }

  spawnCoin(timed) {
    const c = COIN_DASH;
    const { x, y } = this.pickCoinPosition();
    const coin = this.add.circle(x, y, 9, c.colors.coin);
    this.coins.add(coin);
    coin.body.setCircle(9);
    if (timed) {
      const t = c.timedCoins;
      coin.expireAt = this.time.now + Phaser.Math.Between(t.minSeconds * 1000, t.maxSeconds * 1000);
      coin.label = this.add.text(x, y - 20, '', { font: '14px monospace', color: '#ffffff' }).setOrigin(0.5);
    }
  }

  removeCoin(coin) {
    if (coin.label) coin.label.destroy();
    coin.destroy();
  }

  updateTimedCoins() {
    const t = COIN_DASH.timedCoins;
    const now = this.time.now;
    if (this.timedPhase() && now >= this.nextSpawnAt && this.coins.countActive() < t.maxOnBoard) {
      this.spawnCoin(true);
      this.nextSpawnAt = now + t.spawnEverySeconds * 1000;
    }
    for (const coin of this.coins.getChildren().slice()) {
      if (!coin.expireAt) continue;
      const remaining = Math.ceil((coin.expireAt - now) / 1000);
      if (remaining <= 0) this.removeCoin(coin);
      else coin.label.setText(String(remaining));
    }
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    this.updateTimedCoins();
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s`);
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
