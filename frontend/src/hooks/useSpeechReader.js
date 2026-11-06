import { useCallback, useEffect, useRef, useState } from 'react';

// Speech synthesis is shared by the page: only one AccessLens reader owns it.
let speechOwner = null;

export default function useSpeechReader(items, language = '') {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const [voices, setVoices] = useState([]);
  const [voiceChoice, setVoiceChoice] = useState(null);
  const selectedVoice = voices.find((voice) => voice.voiceURI === voiceChoice)
    || voices.find((voice) => /^Google US English$/i.test(voice.name))
    || voices.find((voice) => voice.lang.replace('_', '-').toLowerCase() === 'en-us')
    || voices[0];
  const voiceURI = selectedVoice?.voiceURI || '';
  const [rate, setRate] = useState(1);
  const [status, setStatus] = useState('idle');
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const token = useRef(0);
  const owner = useRef(Symbol('reader'));
  const utterance = useRef(null);
  const currentIndex = useRef(0);
  const playRef = useRef(null);

  const stop = useCallback(() => {
    token.current++;
    if (speechOwner?.id === owner.current) {
      speechOwner = null;
      window.speechSynthesis.cancel();
    }
    utterance.current = null;
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (!supported) return undefined;
    const synth = window.speechSynthesis;
    const update = () => {
      stop();
      setVoices(synth.getVoices().filter((voice) => /\bgoogle\b/i.test(`${voice.name} ${voice.voiceURI}`)));
    };
    update();
    synth.addEventListener('voiceschanged', update);
    return () => synth.removeEventListener('voiceschanged', update);
  }, [supported, stop]);

  useEffect(() => {
    stop(); currentIndex.current = 0; setIndex(0); setError('');
    return stop;
  }, [items, stop]);

  const play = useCallback((start = currentIndex.current) => {
    if (!supported || !items.length || !selectedVoice) return;
    if (speechOwner) speechOwner.stop();
    const synth = window.speechSynthesis;
    const session = ++token.current;
    speechOwner = { id: owner.current, stop };
    setError('');
    const speakNext = (next) => {
      if (session !== token.current) return;
      if (next >= items.length) { speechOwner = null; utterance.current = null; setStatus('finished'); return; }
      currentIndex.current = next; setIndex(next);
      const speech = new window.SpeechSynthesisUtterance(items[next].text);
      speech.voice = selectedVoice;
      speech.lang = selectedVoice.lang;
      speech.rate = rate;
      speech.onend = () => speakNext(next + 1);
      speech.onerror = (event) => {
        if (session !== token.current) return;
        token.current++; speechOwner = null; utterance.current = null; setStatus('idle');
        setError(`Audio could not play (${event.error || 'speech unavailable'}). You can still read the transcript.`);
      };
      utterance.current = speech;
      try { synth.resume(); synth.speak(speech); setStatus('reading'); }
      catch { token.current++; speechOwner = null; setStatus('idle'); setError('Audio is unavailable. The transcript remains readable.'); }
    };
    speakNext(Math.max(0, Math.min(start, items.length - 1)));
  }, [supported, items, selectedVoice, rate, stop]);
  playRef.current = play;

  const select = (next) => {
    const resumeReading = status === 'reading';
    stop();
    const bounded = Math.max(0, Math.min(next, items.length - 1));
    currentIndex.current = bounded; setIndex(bounded);
    if (resumeReading) playRef.current(bounded);
  };
  const pause = () => {
    if (speechOwner?.id !== owner.current) return;
    window.speechSynthesis.pause(); setStatus('paused');
  };
  const resume = () => {
    if (speechOwner?.id !== owner.current) return;
    window.speechSynthesis.resume(); setStatus('reading');
  };
  return { supported, voices, voiceURI, hasVoice: Boolean(selectedVoice), hasUSEnglish: voices.some((voice) => voice.lang.replace('_', '-').toLowerCase() === 'en-us'), rate, status, index, error, play: () => play(status === 'finished' ? 0 : currentIndex.current), stop, pause, resume, select,
    setVoiceURI: (value) => { stop(); setVoiceChoice(value); }, setRate: (value) => { stop(); setRate(value); } };
}
