// Original synthesized Disco Dash loop: no downloads, audio files, or autoplay.
(() => {
  const track = { name: 'Disco Dash', bpm: 140,
    notes: [67, 74, 71, 79, 76, 72, 79, 76, 69, 76, 72, 81, 74, 78, 81, 78],
    bass: [43, 48, 45, 50] };
  const controls = document.getElementById('music-toggle');
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let context;
  let source;
  let playing = false;
  let request = 0;
  let loopBuffer;

  // Build one seamless eight-beat phrase, with short envelopes to avoid clicks.
  function makeLoop(track) {
    const step = 30 / track.bpm;
    const length = Math.round(context.sampleRate * step * track.notes.length);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
    for (let i = 0; i < length; i++) {
      const time = i / context.sampleRate;
      const index = Math.min(track.notes.length - 1, Math.floor(time / step));
      const local = time - index * step;
      const envelope = Math.max(0, Math.min(1, local / .012, (step * .9 - local) / .04));
      const phase = 2 * Math.PI * frequency(track.notes[index]) * local;
      const lead = Math.sin(phase);
      const bassDuration = step;
      const bassTime = time % bassDuration;
      const bassEnvelope = Math.max(0, Math.min(1, bassTime / .02, (bassDuration - bassTime) / .08));
      const bass = Math.sin(2 * Math.PI * frequency(track.bass[Math.floor(index / 4)]) * bassTime);
      const beatTime = time % (step * 2);
      // A falling sine kick, short hi-hats, and a snare on alternate beats.
      const kick = Math.sin(2 * Math.PI * (55 * beatTime + 7 * (1 - Math.exp(-30 * beatTime))));
      const seed = Math.sin(i * 12.9898) * 43758.5453;
      const noise = 2 * (seed - Math.floor(seed)) - 1;
      const hat = Math.sin(2 * Math.PI * 3200 * local);
      const snare = Math.floor(index / 2) % 2 === 1 ? noise * Math.exp(-45 * beatTime) * .025 : 0;
      const drums = kick * Math.exp(-22 * beatTime) * .10 + hat * Math.exp(-90 * local) * .02 + snare;
      // Fade phrase boundaries to keep the percussion loop free of clicks too.
      const edge = Math.min(1, time / .005, (length / context.sampleRate - time) / .005);
      data[i] = (lead * envelope * .10 + bass * bassEnvelope * .07 + drums) * edge;
    }
    return buffer;
  }

  function stopSource() {
    if (!source) return;
    source.stop();
    source.disconnect();
    source = null;
  }

  function render() {
    const label = playing ? 'Mute music' : 'Play music';
    controls.setAttribute('aria-pressed', String(playing));
    controls.setAttribute('aria-label', label);
    controls.title = label;
  }

  async function start() {
    const currentRequest = ++request;
    playing = true;
    stopSource();
    render();
    try {
      // Construct and resume only from a user gesture, as browsers require.
      if (!context) context = new AudioContext();
      await context.resume();
      // Mute may have been pressed while resume was pending.
      if (currentRequest !== request || !playing) return;
      if (!loopBuffer) loopBuffer = makeLoop(track);
      source = context.createBufferSource();
      source.buffer = loopBuffer;
      source.loop = true;
      source.connect(context.destination);
      source.start();
    } catch (error) {
      if (currentRequest !== request) return;
      playing = false;
      stopSource();
      render();
      controls.title = 'Could not play music. Click to try again.';
      controls.setAttribute('aria-label', controls.title);
    }
  }

  controls.addEventListener('click', () => {
    if (!playing) return start();
    ++request;
    playing = false;
    stopSource();
    render();
  });

  // Keep button navigation keys from moving or restarting the game.
  for (const event of ['keydown', 'keyup']) {
    controls.addEventListener(event, e => e.stopPropagation());
  }
  controls.addEventListener('focusin', () => {
    const keyboard = window.coinDashGame?.scene.getScene('CoinDash')?.input.keyboard;
    if (keyboard) keyboard.resetKeys();
  });
  if (!AudioContext) {
    controls.disabled = true;
    controls.title = 'Music is unavailable in this browser.';
    controls.setAttribute('aria-label', controls.title);
  }
})();
