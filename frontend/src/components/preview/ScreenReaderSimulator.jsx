import { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  CheckCircle2,
  AlertTriangle,
  Keyboard,
  Sparkles,
  Info,
} from 'lucide-react';

// Converts ASCII string to approximate Braille pattern Unicode (dots 1-6)
function toBraille(text = '') {
  const brailleMap = {
    a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠓',
    i: '⠊', j: '⠚', k: '⠅', l: '⠇', m: '⠍', n: '⠝', o: '⠕', p: '⠏',
    q: '⠟', r: '⠗', s: '⠎', t: '⠞', u: '⠥', v: '⠧', w: '⠺', x: '⠭',
    y: '⠽', z: '⠵', ' ': ' ', '1': '⠂', '2': '⠆', '3': '⠒', '4': '⠲',
  };
  return text
    .toLowerCase()
    .split('')
    .map((c) => brailleMap[c] || c)
    .join('');
}

export default function ScreenReaderSimulator({ issue }) {
  const [speaking, setSpeaking] = useState(false);
  const [activeMode, setActiveMode] = useState('nvda'); // nvda | voiceover | jaws
  const [viewTab, setViewTab] = useState('speech'); // speech | keyboard | braille

  if (!issue) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400 dark:border-zinc-800">
        Select an issue to hear how screen readers announce it to blind users.
      </div>
    );
  }

  // Derive realistic announcements based on axe rule and code snippets
  const getSimulatedAnnouncements = () => {
    switch (issue.rule) {
      case 'image-alt':
        return {
          before:
            activeMode === 'voiceover'
              ? 'hero.jpg, image. Description unavailable.'
              : 'Graphic, unlabelled, hero.jpg',
          after:
            activeMode === 'voiceover'
              ? 'People collaborating around a table, image'
              : 'Graphic, People collaborating around a table',
          impactNote:
            'Without alternative text, screen reader users only hear an obscure file path or "image", leaving them completely unaware of page context.',
          keyboardNote:
            'Decorative or informative images are passed over in Tab order, but navigated via Screen Reader "G" key (Next Graphic).',
        };
      case 'button-name':
        return {
          before:
            activeMode === 'voiceover'
              ? 'Button'
              : 'Button, blank',
          after:
            activeMode === 'voiceover'
              ? 'Open your account, button'
              : 'Open your account, button',
          impactNote:
            'A blind user pressing Tab to this button hears only "Button", with zero indication of whether clicking will submit a payment, delete their account, or navigate.',
          keyboardNote:
            'Focusable via Tab key. Spacebar or Enter triggers activation. Requires clear programmatic name via aria-label or text child.',
        };
      case 'label':
        return {
          before:
            activeMode === 'voiceover'
              ? 'Edit text, blank'
              : 'Edit, blank',
          after:
            activeMode === 'voiceover'
              ? 'Work email, edit text, required'
              : 'Work email: edit, required',
          impactNote:
            'Screen readers announce what the user needs to type. Without an associated label or placeholder, the user cannot know what data is requested.',
          keyboardNote:
            'Focusable via Tab key. Up/Down arrows navigate options if dropdown; typing enters text.',
        };
      case 'color-contrast':
        return {
          before:
            'Make room for better work. [Low visual contrast: 2.1:1 fails WCAG AA 4.5:1 requirement]',
          after:
            'Make room for better work. [Verified contrast: 7.2:1 exceeds WCAG AAA requirement]',
          impactNote:
            'While screen readers read text regardless of color, low-vision users and users with color blindness cannot visually perceive text below 4.5:1 ratio.',
          keyboardNote:
            'Visual focus rings must maintain at least 3:1 contrast against adjacent colors to remain discoverable when tabbing.',
        };
      case 'document-title':
        return {
          before:
            '[No document title announced. Screen reader announces current window or raw URL]',
          after:
            'AccessLens — Web Accessibility Dashboard, window',
          impactNote:
            'The <title> is the very first thing announced when a blind user opens any tab or link. Without it, switching tabs is disorienting.',
          keyboardNote:
            'Not focusable; automatically vocalized on page load or window focus.',
        };
      case 'html-has-lang':
        return {
          before:
            '[Lang undefined: Text synthesized with host operating system default accent, causing English words to sound incomprehensible if user has Spanish TTS]',
          after:
            '[Lang set to "en": Screen reader switches to English phonetic voice synthesizer]',
          impactNote:
            'Screen readers use the lang attribute to load the correct dictionary and phoneme voice model.',
          keyboardNote: 'Structural document level attribute.',
        };
      default:
        return {
          before: `[${issue.rule}] on element: ${issue.snippet || issue.selector}`,
          after: `[${issue.rule}] Resolved: ${issue.fix || 'Accessible structure verified'}`,
          impactNote: issue.explanation,
          keyboardNote: 'Element must support logical DOM tab navigation order.',
        };
    }
  };

  const sim = getSimulatedAnnouncements();

  const handleSpeak = (textToSpeak) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech Synthesis API is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    setSpeaking(true);

    const cleanText = textToSpeak.replace(/\[.*?\]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText || textToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header with Mode Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
        <div className="flex items-center gap-2">
          <Volume2 size={16} className="text-orange-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
            Screen Reader Simulator
          </h3>
        </div>

        {/* Reader Type Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
          {[
            ['nvda', 'NVDA (Win)'],
            ['voiceover', 'VoiceOver (Mac/iOS)'],
            ['jaws', 'JAWS (Win)'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveMode(id)}
              className={`rounded-md px-2 py-1 text-[10px] font-bold transition-all ${
                activeMode === id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs: Spoken Audio vs Keyboard vs Braille */}
      <div className="flex border-b border-zinc-100 px-4 dark:border-zinc-800">
        {[
          ['speech', 'Spoken Announcements'],
          ['keyboard', 'Keyboard & Focus'],
          ['braille', 'Refreshable Braille Output'],
        ].map(([tab, title]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setViewTab(tab)}
            className={`border-b-2 px-3 py-2 text-[11px] font-bold transition-colors ${
              viewTab === tab
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
            }`}
          >
            {title}
          </button>
        ))}
      </div>

      <div className="p-4">
        {viewTab === 'speech' && (
          <div className="space-y-3.5">
            {/* Before Fix Audio Simulator */}
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3.5 dark:border-red-900/40 dark:bg-red-950/20">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 dark:text-red-400">
                  <AlertTriangle size={13} />
                  What Blind Users Hear Today (Broken):
                </span>

                <button
                  type="button"
                  onClick={() =>
                    speaking ? handleStopSpeak() : handleSpeak(sim.before)
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 shadow-sm transition-all hover:bg-red-50 active:scale-95 dark:border-red-800 dark:bg-zinc-800 dark:text-red-300"
                >
                  {speaking ? (
                    <>
                      <VolumeX size={13} className="text-red-500" /> Stop
                    </>
                  ) : (
                    <>
                      <Volume2 size={13} className="text-red-500" /> Listen Aloud
                    </>
                  )}
                </button>
              </div>

              <p className="mt-2 font-mono text-[11px] font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
                "{sim.before}"
              </p>
            </div>

            {/* After Fix Audio Simulator */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={13} />
                  What Blind Users Hear After Applying Fix:
                </span>

                <button
                  type="button"
                  onClick={() =>
                    speaking ? handleStopSpeak() : handleSpeak(sim.after)
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 active:scale-95 dark:border-emerald-800 dark:bg-zinc-800 dark:text-emerald-300"
                >
                  {speaking ? (
                    <>
                      <VolumeX size={13} className="text-emerald-500" /> Stop
                    </>
                  ) : (
                    <>
                      <Volume2 size={13} className="text-emerald-500" /> Listen Aloud
                    </>
                  )}
                </button>
              </div>

              <p className="mt-2 font-mono text-[11px] font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
                "{sim.after}"
              </p>
            </div>

            <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                Why this matters:{' '}
              </span>
              {sim.impactNote}
            </p>
          </div>
        )}

        {viewTab === 'keyboard' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200">
              <Keyboard size={15} className="text-orange-500" />
              Keyboard Navigation & Focus Ring
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {sim.keyboardNote}
            </p>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              Target Selector: <span className="font-bold text-orange-600 dark:text-orange-400">{issue.selector}</span>
            </div>
          </div>
        )}

        {viewTab === 'braille' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Refreshable 8-Dot Braille Terminal Output
              </span>
              <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800">
                Grade 1 Uncontracted
              </span>
            </div>
            <div className="rounded-lg border border-zinc-300 bg-zinc-900 p-4 font-mono text-lg tracking-widest text-emerald-400 dark:border-zinc-700">
              {toBraille(sim.after.replace(/\[.*?\]/g, '').trim())}
            </div>
            <p className="text-[10px] text-zinc-400">
              Deaf-blind individuals and tactile screen reader users rely on hardware refreshable braille displays that dynamically raise pins matching the accessibility text above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
