import { useEffect, useState } from "react";

const AUDIO_STORAGE_KEY =
 "dialogueQuestAudioEnabled";
const MUSIC_VOLUME = 0.2;

const subscribers = new Set();

let audioPreference = readStoredPreference();
let audioContext = null;
let masterGain = null;
let musicGain = null;
let effectsGain = null;
let schedulerId = null;
let currentMusicMode = "home";
let activeMusicMode = "";
let nextNoteTime = 0;
let stepIndex = 0;
let unlockListenersActive = false;

const themes = {
 home: {
  // Welcoming lobby vibe — C major, I-V-vi-IV (Don't Stop Believin' progression)
  tempo: 104,
  swing: 0.06,
  pad: [
   [261.63, 329.63, 392],     // C major
   [196,    246.94, 293.66],  // G major
   [220,    261.63, 329.63],  // A minor
   [174.61, 220,    261.63]   // F major
  ],
  bass: [
   // C: C2 G2 C2 E2
   65.41,  98,     65.41,  82.41,
   // G: G2 D3 G2 B2
   98,     146.83, 98,     123.47,
   // Am: A2 E3 A2 C3
   110,    164.81, 110,    130.81,
   // F: F2 C3 F2 A2
   87.31,  130.81, 87.31,  110
  ],
  melody: [
   // C bar
   659.25, null,   783.99, null,
   523.25, null,   659.25, null,
   // G bar
   587.33, null,   493.88, null,
   587.33, 698.46, 587.33, null,
   // Am bar
   523.25, null,   659.25, null,
   440,    null,   523.25, null,
   // F bar
   523.25, null,   440,    null,
   349.23, null,   440,    null
  ],
  // C major pentatonic shimmer
  arp: [
   523.25, 659.25, 783.99, 1046.5,
   783.99, 659.25, 523.25, 392
  ],
  kickPattern: [1, 0, 0, 0, 1, 0, 1, 0],
  hatPattern:  [0, 0, 1, 0, 0, 0, 1, 0],
  arpPattern:  [0, 0, 0, 1, 0, 1, 0, 1],
  wave: "triangle",
  padVolume: 0.045,
  melodyVolume: 0.07,
  bassVolume: 0.115,
  arpVolume: 0.028,
  kickVolume: 0.16,
  hatVolume: 0.045
 },
 solo: {
  // Focused trivia thinking — A minor, vi-IV-V-i feel (dramatic but engaging)
  tempo: 112,
  swing: 0.08,
  pad: [
   [220,    261.63, 329.63],  // A minor
   [174.61, 220,    261.63],  // F major
   [196,    246.94, 293.66],  // G major
   [164.81, 196,    246.94]   // E minor
  ],
  bass: [
   // Am: A2 A2 E3 A2
   110,    110,    164.81, 110,
   // F: F2 F2 C3 F2
   87.31,  87.31,  130.81, 87.31,
   // G: G2 G2 D3 G2
   98,     98,     146.83, 98,
   // Em: E2 E2 B2 E2
   82.41,  82.41,  123.47, 82.41
  ],
  melody: [
   // Am bar
   659.25, null,   587.33, null,
   523.25, null,   659.25, null,
   // F bar
   698.46, null,   523.25, null,
   587.33, null,   698.46, null,
   // G bar
   587.33, null,   493.88, null,
   587.33, null,   698.46, null,
   // Em bar
   493.88, null,   587.33, null,
   493.88, null,   659.25, null
  ],
  // A minor pentatonic (tick-tock thinking arp)
  arp: [
   440,    523.25, 659.25, 880,
   659.25, 523.25, 440,    329.63
  ],
  kickPattern: [1, 0, 0, 0, 1, 0, 0, 0],
  hatPattern:  [0, 1, 0, 1, 0, 1, 0, 1],
  arpPattern:  [0, 1, 0, 1, 0, 1, 0, 1],
  wave: "sawtooth",
  padVolume: 0.034,
  melodyVolume: 0.07,
  bassVolume: 0.118,
  arpVolume: 0.032,
  kickVolume: 0.15,
  hatVolume: 0.05
 },
 multiplayer: {
  // Game-show finale energy — E minor / G major, driving 4/4
  tempo: 130,
  swing: 0.03,
  pad: [
   [164.81, 196,    246.94],  // E minor
   [261.63, 329.63, 392],     // C major
   [196,    246.94, 293.66],  // G major
   [146.83, 184.99, 220]      // D major
  ],
  bass: [
   // Em: E2 E2 B2 E2
   82.41,  82.41,  123.47, 82.41,
   // C: C3 C3 G2 C3
   130.81, 130.81, 196,    130.81,
   // G: G2 G2 D3 G2
   98,     98,     146.83, 98,
   // D: D2 D2 A2 D2
   73.42,  73.42,  110,    73.42
  ],
  melody: [
   // Em punch
   659.25, null,   587.33, null,
   659.25, 783.99, 880,    null,
   // C lift
   783.99, null,   659.25, null,
   523.25, 659.25, 783.99, null,
   // G stride
   587.33, null,   493.88, null,
   587.33, 783.99, 880,    null,
   // D push
   587.33, null,   440,    null,
   493.88, 587.33, 698.46, null
  ],
  // G major pentatonic charge
  arp: [
   196,    293.66, 369.99, 440,
   587.33, 440,    369.99, 293.66
  ],
  kickPattern: [1, 0, 1, 0, 1, 0, 1, 1],
  hatPattern:  [1, 1, 1, 1, 1, 1, 1, 1],
  clapPattern: [0, 0, 1, 0, 0, 0, 1, 0],
  arpPattern:  [1, 0, 1, 0, 1, 0, 1, 0],
  wave: "square",
  padVolume: 0.04,
  melodyVolume: 0.078,
  bassVolume: 0.13,
  arpVolume: 0.04,
  kickVolume: 0.22,
  hatVolume: 0.055,
  clapVolume: 0.11
 }
};

function readStoredPreference() {
 if (typeof window === "undefined") {
  return false;
 }

 try {
  return (
   window.localStorage.getItem(
    AUDIO_STORAGE_KEY
   ) === "true"
  );
 } catch {
  return false;
 }
}

function writeStoredPreference(enabled) {
 if (typeof window === "undefined") return;

 try {
  window.localStorage.setItem(
   AUDIO_STORAGE_KEY,
   enabled ? "true" : "false"
  );
 } catch {
  // Audio can still work without storage.
 }
}

function notifySubscribers() {
 subscribers.forEach((callback) =>
  callback(audioPreference)
 );
}

function getAudioContext() {
 if (typeof window === "undefined") {
  return null;
 }

 if (audioContext) {
  return audioContext;
 }

 const AudioContextCtor =
  window.AudioContext ||
  window.webkitAudioContext;

 if (!AudioContextCtor) {
  return null;
 }

 audioContext = new AudioContextCtor();
 masterGain = audioContext.createGain();
 musicGain = audioContext.createGain();
 effectsGain = audioContext.createGain();

 masterGain.gain.value = 0.9;
 musicGain.gain.value = 0;
 effectsGain.gain.value = 0.7;

 musicGain.connect(masterGain);
 effectsGain.connect(masterGain);
 masterGain.connect(audioContext.destination);

 return audioContext;
}

function resumeAudioContext() {
 const context = getAudioContext();

 if (
  context &&
  context.state === "suspended"
 ) {
  context.resume().catch(() => {});
 }
}

function addUnlockListeners() {
 if (
  unlockListenersActive ||
  typeof window === "undefined"
 ) {
  return;
 }

 const unlock = () => {
  if (!audioPreference) return;

  resumeAudioContext();
  startMusic(currentMusicMode);
 };

 [
  "pointerdown",
  "keydown",
  "touchstart",
  "click"
 ].forEach((eventName) => {
  window.addEventListener(eventName, unlock, {
   passive: true
  });
 });

 unlockListenersActive = true;
}

function scheduleTone({
 frequency,
 time,
 duration,
 type = "sine",
 volume = 0.12,
 destination,
 detune = 0
}) {
 const context = getAudioContext();
 const output = destination || musicGain;

 if (!context || !output || !frequency) {
  return;
 }

 const oscillator = context.createOscillator();
 const gain = context.createGain();
 const attack = Math.min(0.035, duration * 0.25);
 const release = Math.max(
  attack + 0.02,
  duration - 0.04
 );

 oscillator.type = type;
 oscillator.frequency.setValueAtTime(
  frequency,
  time
 );

 if (detune) {
  oscillator.detune.setValueAtTime(detune, time);
 }

 gain.gain.setValueAtTime(0.0001, time);
 gain.gain.exponentialRampToValueAtTime(
  Math.max(0.0001, volume),
  time + attack
 );
 gain.gain.exponentialRampToValueAtTime(
  Math.max(0.0001, volume * 0.5),
  time + duration * 0.6
 );
 gain.gain.exponentialRampToValueAtTime(
  0.0001,
  time + release
 );

 oscillator.connect(gain);
 gain.connect(output);
 oscillator.start(time);
 oscillator.stop(time + duration + 0.05);
}

function scheduleChord({
 frequencies,
 time,
 duration,
 type = "triangle",
 volume = 0.04,
 destination,
 spread = 6
}) {
 frequencies.forEach((frequency, index) => {
  if (!frequency) return;

  const detune =
   ((index - (frequencies.length - 1) / 2) *
    spread) /
   Math.max(1, frequencies.length - 1);

  scheduleTone({
   frequency,
   time,
   duration,
   type,
   volume: volume * (index === 0 ? 1 : 0.85),
   destination,
   detune
  });
 });
}

function scheduleNoise({
 time,
 duration = 0.12,
 volume = 0.08,
 destination
}) {
 const context = getAudioContext();
 const output = destination || effectsGain;

 if (!context || !output) return;

 const sampleCount = Math.max(
  1,
  Math.floor(context.sampleRate * duration)
 );
 const buffer = context.createBuffer(
  1,
  sampleCount,
  context.sampleRate
 );
 const data = buffer.getChannelData(0);

 for (let index = 0; index < sampleCount; index += 1) {
  data[index] =
   (Math.random() * 2 - 1) *
   (1 - index / sampleCount);
 }

 const source = context.createBufferSource();
 const filter = context.createBiquadFilter();
 const gain = context.createGain();

 source.buffer = buffer;
 filter.type = "highpass";
 filter.frequency.setValueAtTime(1200, time);
 gain.gain.setValueAtTime(0.0001, time);
 gain.gain.exponentialRampToValueAtTime(
  volume,
  time + 0.01
 );
 gain.gain.exponentialRampToValueAtTime(
  0.0001,
  time + duration
 );

 source.connect(filter);
 filter.connect(gain);
 gain.connect(output);
 source.start(time);
 source.stop(time + duration + 0.02);
}

function scheduleKick({
 time,
 volume = 0.2,
 destination
}) {
 const context = getAudioContext();
 const output = destination || musicGain;

 if (!context || !output) return;

 const osc = context.createOscillator();
 const gain = context.createGain();
 const click = context.createOscillator();
 const clickGain = context.createGain();

 osc.type = "sine";
 osc.frequency.setValueAtTime(150, time);
 osc.frequency.exponentialRampToValueAtTime(
  45,
  time + 0.13
 );

 gain.gain.setValueAtTime(0.0001, time);
 gain.gain.exponentialRampToValueAtTime(
  volume,
  time + 0.006
 );
 gain.gain.exponentialRampToValueAtTime(
  0.0001,
  time + 0.22
 );

 click.type = "triangle";
 click.frequency.setValueAtTime(1600, time);
 clickGain.gain.setValueAtTime(volume * 0.35, time);
 clickGain.gain.exponentialRampToValueAtTime(
  0.0001,
  time + 0.022
 );

 osc.connect(gain);
 click.connect(clickGain);
 gain.connect(output);
 clickGain.connect(output);
 osc.start(time);
 osc.stop(time + 0.26);
 click.start(time);
 click.stop(time + 0.04);
}

function scheduleHat({
 time,
 volume = 0.05,
 destination,
 open = false
}) {
 const context = getAudioContext();
 const output = destination || musicGain;

 if (!context || !output) return;

 const duration = open ? 0.16 : 0.045;
 const sampleCount = Math.max(
  1,
  Math.floor(context.sampleRate * duration)
 );
 const buffer = context.createBuffer(
  1,
  sampleCount,
  context.sampleRate
 );
 const data = buffer.getChannelData(0);

 for (let index = 0; index < sampleCount; index += 1) {
  data[index] =
   (Math.random() * 2 - 1) *
   (1 - index / sampleCount);
 }

 const source = context.createBufferSource();
 const filter = context.createBiquadFilter();
 const gain = context.createGain();

 source.buffer = buffer;
 filter.type = "highpass";
 filter.frequency.setValueAtTime(7500, time);
 gain.gain.setValueAtTime(0.0001, time);
 gain.gain.exponentialRampToValueAtTime(
  volume,
  time + 0.003
 );
 gain.gain.exponentialRampToValueAtTime(
  0.0001,
  time + duration
 );

 source.connect(filter);
 filter.connect(gain);
 gain.connect(output);
 source.start(time);
 source.stop(time + duration + 0.02);
}

function scheduleClap({
 time,
 volume = 0.1,
 destination
}) {
 const context = getAudioContext();
 const output = destination || musicGain;

 if (!context || !output) return;

 const duration = 0.09;
 const sampleCount = Math.max(
  1,
  Math.floor(context.sampleRate * duration)
 );
 const buffer = context.createBuffer(
  1,
  sampleCount,
  context.sampleRate
 );
 const data = buffer.getChannelData(0);

 for (let index = 0; index < sampleCount; index += 1) {
  data[index] =
   (Math.random() * 2 - 1) *
   (1 - index / sampleCount);
 }

 const source = context.createBufferSource();
 const filter = context.createBiquadFilter();
 const gain = context.createGain();

 source.buffer = buffer;
 filter.type = "bandpass";
 filter.frequency.setValueAtTime(1800, time);
 filter.Q.value = 1.4;
 gain.gain.setValueAtTime(0.0001, time);
 gain.gain.exponentialRampToValueAtTime(
  volume,
  time + 0.005
 );
 gain.gain.exponentialRampToValueAtTime(
  0.0001,
  time + duration
 );

 source.connect(filter);
 filter.connect(gain);
 gain.connect(output);
 source.start(time);
 source.stop(time + duration + 0.02);
}

function scheduleMusicStep(
 theme,
 time,
 stepDuration
) {
 const melodyLength = theme.melody.length;
 const bassLength = theme.bass.length;
 const padLength = theme.pad.length;
 const arpLength = theme.arp?.length || 0;
 const kickLength = theme.kickPattern?.length || 0;
 const hatLength = theme.hatPattern?.length || 0;
 const clapLength = theme.clapPattern?.length || 0;
 const arpPatternLength = theme.arpPattern?.length || 0;

 const step = stepIndex % 32;
 const measureStep = stepIndex % 8;
 const melodyStep = stepIndex % melodyLength;
 const bassStep = Math.floor(stepIndex / 2) % bassLength;
 const padChordIndex =
  Math.floor(stepIndex / 8) % padLength;
 const arpStep = arpLength
  ? stepIndex % arpLength
  : 0;

 if (
  kickLength &&
  theme.kickPattern[stepIndex % kickLength]
 ) {
  scheduleKick({
   time,
   volume: theme.kickVolume ?? 0.18,
   destination: musicGain
  });
 }

 if (
  hatLength &&
  theme.hatPattern[stepIndex % hatLength]
 ) {
  scheduleHat({
   time,
   volume:
    measureStep % 2 === 0
     ? (theme.hatVolume ?? 0.05) * 0.7
     : theme.hatVolume ?? 0.05,
   destination: musicGain,
   open: measureStep === 7
  });
 }

 if (
  clapLength &&
  theme.clapPattern[stepIndex % clapLength]
 ) {
  scheduleClap({
   time,
   volume: theme.clapVolume ?? 0.1,
   destination: musicGain
  });
 }

 if (stepIndex % 2 === 0) {
  scheduleTone({
   frequency: theme.bass[bassStep],
   time,
   duration: stepDuration * 1.6,
   type: "sine",
   volume: theme.bassVolume ?? 0.13,
   destination: musicGain
  });

  scheduleTone({
   frequency: theme.bass[bassStep] * 0.5,
   time,
   duration: stepDuration * 1.6,
   type: "triangle",
   volume: (theme.bassVolume ?? 0.13) * 0.45,
   destination: musicGain
  });
 }

 if (step % 8 === 0) {
  scheduleChord({
   frequencies: theme.pad[padChordIndex],
   time,
   duration: stepDuration * 8.4,
   type: "triangle",
   volume: theme.padVolume ?? 0.03,
   destination: musicGain,
   spread: 5
  });
 }

 const melodyNote = theme.melody[melodyStep];

 if (melodyNote) {
  scheduleTone({
   frequency: melodyNote,
   time,
   duration: stepDuration * 0.88,
   type: theme.wave,
   volume: theme.melodyVolume ?? 0.07,
   destination: musicGain
  });

  scheduleTone({
   frequency: melodyNote * 2,
   time: time + stepDuration * 0.18,
   duration: stepDuration * 0.5,
   type: "sine",
   volume: (theme.melodyVolume ?? 0.07) * 0.28,
   destination: musicGain
  });
 }

 const arpShouldPlay = arpPatternLength
  ? theme.arpPattern[stepIndex % arpPatternLength]
  : stepIndex % 2 === 1;

 if (arpLength && arpShouldPlay) {
  scheduleTone({
   frequency: theme.arp[arpStep % arpLength],
   time,
   duration: stepDuration * 0.55,
   type: "triangle",
   volume: theme.arpVolume ?? 0.03,
   destination: musicGain
  });
 }

 stepIndex += 1;
}

function scheduleMusic() {
 const context = getAudioContext();
 const theme =
  themes[currentMusicMode] || themes.home;

 if (!context || !audioPreference) return;

 const stepDuration = 60 / theme.tempo / 2;
 const swing = theme.swing || 0;
 const scheduleUntil =
  context.currentTime + 0.45;

 if (!nextNoteTime) {
  nextNoteTime = context.currentTime + 0.06;
 }

 while (nextNoteTime < scheduleUntil) {
  const swingOffset =
   stepIndex % 2 === 1
    ? stepDuration * swing
    : 0;

  scheduleMusicStep(
   theme,
   nextNoteTime + swingOffset,
   stepDuration
  );
  nextNoteTime += stepDuration;
 }
}

function startMusic(mode = currentMusicMode) {
 currentMusicMode = themes[mode]
  ? mode
  : "home";

 if (!audioPreference) {
  stopMusic();
  return;
 }

 const context = getAudioContext();

 if (!context) {
  stopMusic();
  return;
 }

 addUnlockListeners();
 resumeAudioContext();

 if (activeMusicMode !== currentMusicMode) {
  activeMusicMode = currentMusicMode;
  stepIndex = 0;
  nextNoteTime = context.currentTime + 0.06;
 }

 musicGain.gain.cancelScheduledValues(
  context.currentTime
 );
 musicGain.gain.setTargetAtTime(
  MUSIC_VOLUME,
  context.currentTime,
  0.25
 );

 if (!schedulerId) {
  scheduleMusic();
  schedulerId = window.setInterval(
   scheduleMusic,
   90
  );
 }
}

function stopMusic() {
 if (schedulerId) {
  window.clearInterval(schedulerId);
  schedulerId = null;
 }

 if (!audioContext || !musicGain) return;

 musicGain.gain.cancelScheduledValues(
  audioContext.currentTime
 );
 musicGain.gain.setTargetAtTime(
  0.0001,
  audioContext.currentTime,
  0.15
 );
}

export function isAudioEnabled() {
 return audioPreference;
}

export function setAudioPreference(enabled) {
 audioPreference = Boolean(enabled);
 writeStoredPreference(audioPreference);
 notifySubscribers();

 if (audioPreference) {
  startMusic(currentMusicMode);
 } else {
  stopMusic();
 }
}

export function toggleAudioPreference() {
 setAudioPreference(!audioPreference);
 return audioPreference;
}

export function useAudioPreference() {
 const [enabled, setEnabled] = useState(
  audioPreference
 );

 useEffect(() => {
  const callback = (nextEnabled) => {
   setEnabled(nextEnabled);
  };

  subscribers.add(callback);

  return () => {
   subscribers.delete(callback);
  };
 }, []);

 return [enabled, setAudioPreference];
}

export function useMusicMode(mode) {
 useEffect(() => {
  startMusic(mode);
 }, [mode]);
}

export function playSoundEffect(kind) {
 if (!audioPreference) return;

 const context = getAudioContext();
 if (!context || !effectsGain) return;

 resumeAudioContext();

 const now = context.currentTime + 0.015;

 if (kind === "correct") {
  [523.25, 659.25, 783.99].forEach(
   (frequency, index) => {
    scheduleTone({
     frequency,
     time: now + index * 0.065,
     duration: 0.18,
     type: "triangle",
     volume: 0.18,
     destination: effectsGain
    });
   }
  );
  return;
 }

 if (kind === "incorrect") {
  [246.94, 207.65].forEach(
   (frequency, index) => {
    scheduleTone({
     frequency,
     time: now + index * 0.09,
     duration: 0.22,
     type: "sawtooth",
     volume: 0.12,
     destination: effectsGain
    });
   }
  );
  scheduleNoise({
   time: now + 0.02,
   duration: 0.12,
   volume: 0.035,
   destination: effectsGain
  });
  return;
 }

 if (kind === "roomCreate") {
  [392, 493.88, 587.33, 783.99].forEach(
   (frequency, index) => {
    scheduleTone({
     frequency,
     time: now + index * 0.055,
     duration: 0.16,
     type: "square",
     volume: 0.11,
     destination: effectsGain
    });
   }
  );
  return;
 }

 if (kind === "roomJoin") {
  [440, 659.25].forEach(
   (frequency, index) => {
    scheduleTone({
     frequency,
     time: now + index * 0.08,
     duration: 0.2,
     type: "triangle",
     volume: 0.14,
     destination: effectsGain
    });
   }
  );
  return;
 }

 if (kind === "leave") {
  [392, 293.66, 196].forEach(
   (frequency, index) => {
    scheduleTone({
     frequency,
     time: now + index * 0.06,
     duration: 0.16,
     type: "sine",
     volume: 0.12,
     destination: effectsGain
    });
   }
  );
  return;
 }

 if (kind === "start") {
  [523.25, 659.25, 880].forEach(
   (frequency, index) => {
    scheduleTone({
     frequency,
     time: now + index * 0.11,
     duration: 0.19,
     type: "square",
     volume: 0.13,
     destination: effectsGain
    });
   }
  );
  return;
 }

 scheduleTone({
  frequency: 523.25,
  time: now,
  duration: 0.15,
  type: "triangle",
  volume: 0.12,
  destination: effectsGain
 });
}
