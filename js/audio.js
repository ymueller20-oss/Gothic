// Prozedurale Klangkulisse: Wind, Brummen, ferne Glocke, Schläge.

let ac = null, master = null, enabled = true, whisperGain = null;

function noiseBuffer(sec) {
  const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  return b;
}

export function startAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = enabled ? 0.8 : 0;
  master.connect(ac.destination);

  // Wind
  const wind = ac.createBufferSource();
  wind.buffer = noiseBuffer(4); wind.loop = true;
  const wf = ac.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420;
  const wg = ac.createGain(); wg.gain.value = 0.35;
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
  const lg = ac.createGain(); lg.gain.value = 0.2;
  lfo.connect(lg); lg.connect(wg.gain);
  const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.11;
  const lg2 = ac.createGain(); lg2.gain.value = 220;
  lfo2.connect(lg2); lg2.connect(wf.frequency);
  wind.connect(wf); wf.connect(wg); wg.connect(master);
  wind.start(); lfo.start(); lfo2.start();

  // Tiefes Brummen
  for (const f of [43.6, 55, 65.4]) {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ac.createGain(); g.gain.value = 0.045;
    o.connect(g); g.connect(master); o.start();
  }

  // Flüstern der Fahlen (Lautstärke je nach Nähe)
  const wh = ac.createBufferSource(); wh.buffer = noiseBuffer(3); wh.loop = true;
  const bf = ac.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1800; bf.Q.value = 6;
  whisperGain = ac.createGain(); whisperGain.gain.value = 0;
  wh.connect(bf); bf.connect(whisperGain); whisperGain.connect(master); wh.start();

  scheduleBell();
}

function scheduleBell() {
  setTimeout(() => { bell(); scheduleBell(); }, 35000 + Math.random() * 50000);
}

function bell() {
  if (!ac) return;
  const t = ac.currentTime;
  for (const [f, a] of [[196, 0.12], [392.5, 0.05], [587, 0.025]]) {
    const o = ac.createOscillator(); o.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 6);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 6.1);
  }
}

function burst(freq, dur, vol, type = 'lowpass') {
  if (!ac) return;
  const t = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = noiseBuffer(dur + 0.05);
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}

export const sfx = {
  swing: () => burst(900, 0.15, 0.25, 'bandpass'),
  hit: () => burst(300, 0.2, 0.6),
  hurt: () => { burst(160, 0.35, 0.8); },
  ignite: () => { burst(2500, 0.5, 0.25, 'highpass'); burst(200, 0.6, 0.3); },
  pickup: () => {
    if (!ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(780, t + 0.12);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
  },
  step: () => burst(500, 0.05, 0.05),
  bell,
};

export function setWhisper(v) {
  if (whisperGain) whisperGain.gain.setTargetAtTime(Math.min(0.5, v), ac.currentTime, 0.3);
}

export function toggleAudio() {
  enabled = !enabled;
  if (master) master.gain.value = enabled ? 0.8 : 0;
  return enabled;
}

export const audioEnabled = () => enabled;
