// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  timedCoins: { startAfterSeconds: 10, minSeconds: 3, maxSeconds: 4, spawnEverySeconds: 1.5, maxOnBoard: 3 },
  speedCoin: { spawnEverySeconds: 6, lifetimeSeconds: 4, boostSeconds: 5, boostMultiplier: 1.5 },
  rageSeconds: 6,
  rageScale: 3,
  ragePulse: 0.08,
  hazardRespawnSeconds: 3,
  colors: {
    background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a,
    speedCoin: 0x3fe0ff, hazard: 0x9b86b5, droneEnraged: 0x800020, droneEnragedFlash: 0xd6334a
  }
};
