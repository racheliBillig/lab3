// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  rageSeconds: 6,
  rageScale: 1.5,
  ragePulse: 0.08,
  hazardRespawnSeconds: 3,
  colors: {
    background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a,
    hazard: 0x9b86b5, droneEnraged: 0x800020, droneEnragedFlash: 0xd6334a
  }
};
