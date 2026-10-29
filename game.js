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
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
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
