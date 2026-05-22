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
  tempo: 82,
  bass: [130.81, 130.81, 146.83, 164.81],
  pad: [261.63, 329.63, 392],
  melody: [
   392,
   null,
   493.88,
   null,
   440,
   null,
   329.63,
   null
  ],
  wave: "triangle"
 },
 solo: {
  tempo: 104,
  bass: [146.83, 146.83, 174.61, 196],
  pad: [293.66, 349.23, 440],
  melody: [
   587.33,
   659.25,
   null,
   493.88,
   587.33,
   null,
   440,
   null
  ],
  wave: "sawtooth"
 },
 multiplayer: {
  tempo: 118,
  bass: [164.81, 196, 220, 196],
  pad: [329.63, 392, 493.88],
  melody: [
   659.25,
   null,
   783.99,
   659.25,
   587.33,
   null,
   493.88,
   587.33
  ],
  wave: "square"
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
 destination
}) {
 const context = getAudioContext();
 const output = destination || musicGain;

 if (!context || !output || !frequency) {
  return;
 }

 const oscillator = context.createOscillator();
 const gain = context.createGain();
 const attack = Math.min(0.025, duration * 0.2);
 const release = Math.max(
  attack + 0.01,
  duration - 0.03
 );

 oscillator.type = type;
 oscillator.frequency.setValueAtTime(
  frequency,
  time
 );
 gain.gain.setValueAtTime(0.0001, time);
 gain.gain.exponentialRampToValueAtTime(
  Math.max(0.0001, volume),
  time + attack
 );
 gain.gain.exponentialRampToValueAtTime(
  0.0001,
  time + release
 );

 oscillator.connect(gain);
 gain.connect(output);
 oscillator.start(time);
 oscillator.stop(time + duration + 0.04);
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

function scheduleMusicStep(
 theme,
 time,
 stepDuration
) {
 const step = stepIndex % 16;
 const barStep = stepIndex % 8;
 const bassIndex =
  Math.floor(stepIndex / 4) %
  theme.bass.length;
 const melody =
  theme.melody[
   barStep % theme.melody.length
  ];

 if (step % 4 === 0) {
  scheduleTone({
   frequency: theme.bass[bassIndex],
   time,
   duration: stepDuration * 1.8,
   type: "sine",
   volume: 0.13,
   destination: musicGain
  });
 }

 if (step % 8 === 0) {
  theme.pad.forEach((frequency) => {
   scheduleTone({
    frequency,
    time,
    duration: stepDuration * 6,
    type: "triangle",
    volume: 0.025,
    destination: musicGain
   });
  });
 }

 if (melody) {
  scheduleTone({
   frequency: melody,
   time,
   duration: stepDuration * 0.82,
   type: theme.wave,
   volume:
    currentMusicMode === "multiplayer"
     ? 0.075
     : 0.065,
   destination: musicGain
  });
 }

 if (
  currentMusicMode === "multiplayer" &&
  step % 4 === 2
 ) {
  scheduleNoise({
   time,
   duration: 0.055,
   volume: 0.025,
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
 const scheduleUntil =
  context.currentTime + 0.45;

 if (!nextNoteTime) {
  nextNoteTime = context.currentTime + 0.06;
 }

 while (nextNoteTime < scheduleUntil) {
  scheduleMusicStep(
   theme,
   nextNoteTime,
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
