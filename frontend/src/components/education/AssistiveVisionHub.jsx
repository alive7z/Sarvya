import PageHeader from '../layout/PageHeader.jsx';
import { useState } from 'react';
import {
  Eye,
  Glasses,
  Volume2,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Info,
  HelpCircle,
  Keyboard,
  Compass,
  Contrast,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

// Relative luminance formula per WCAG 2.1
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function calculateContrastRatio(color1, color2) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export default function AssistiveVisionHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('colorblind');
  const [textColor, setTextColor] = useState('#111827');
  const [bgColor, setBgColor] = useState('#ffffff');

  const ratio = calculateContrastRatio(textColor, bgColor);
  const ratioFormatted = ratio.toFixed(2) + ':1';
  const passAANormal = ratio >= 4.5;
  const passAALarge = ratio >= 3.0;
  const passAAANormal = ratio >= 7.0;

  const colorBlindTypes = [
    {
      name: 'Deuteranopia',
      commonName: 'Green-Blind / Red-Green Deficiency',
      prevalence: '~5.0% of men · 0.4% of women (Most Common)',
      description:
        'Cones that perceive green light are missing. Reds, greens, browns, and oranges appear very similar, often blending into murky yellows or grays.',
      impact:
        'Success/Error banners that use only green and red borders are completely indistinguishable without icons or text labels.',
      badgeTone: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    },
    {
      name: 'Protanopia',
      commonName: 'Red-Blind / Protanomaly',
      prevalence: '~1.0% of men · 0.02% of women',
      description:
        'Cones that perceive red light are absent. Red appears dark gray or black, while orange, yellow, and green all appear yellowish.',
      impact:
        'Red notification badges and error outlines look dim or invisible against dark backgrounds.',
      badgeTone: 'border-red-200 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300',
    },
    {
      name: 'Tritanopia',
      commonName: 'Blue-Yellow Deficiency',
      prevalence: '~0.01% of population (Men & Women equally)',
      description:
        'Cones that perceive short-wavelength blue light are missing. Blue appears greenish, and yellow appears violet, magenta, or gray.',
      impact:
        'Links that rely solely on blue text without underlines are impossible to spot inside black or dark text.',
      badgeTone: 'border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    },
    {
      name: 'Achromatopsia',
      commonName: 'Monochromacy (Complete Color Blindness)',
      prevalence: '~0.003% of population (1 in 33,000)',
      description:
        'Complete absence of all functioning cone cells. Individuals see the world entirely in shades of black, gray, and white.',
      impact:
        'Information communicated through color alone is 100% lost. Text readability depends entirely on pure brightness contrast.',
      badgeTone: 'border-zinc-300 bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
    },
    {
      name: 'Low Vision & Blur',
      commonName: 'Visual Acuity Loss & Cataracts',
      prevalence: 'Over 250 million people globally',
      description:
        'Clouded lenses, macular degeneration, or uncorrected refractive errors cause heavy optical blur, loss of sharpness, and extreme light glare sensitivity.',
      impact:
        'Thin, low-contrast fonts (e.g. gray #999 on white) dissolve into invisible haze. Requires bold strokes, strong contrast, and scalable text.',
      badgeTone: 'border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    },
  ];

  const screenReaders = [
    {
      name: 'NVDA (NonVisual Desktop Access)',
      platform: 'Windows (Free & Open Source)',
      share: '~40% Global Desktop Market Share',
      description:
        'Developed by NV Access, a free, lightweight screen reader beloved by blind developers and everyday users on Windows. Excellent compatibility with Chrome and Firefox.',
      topKey: 'NVDA + Space (Focus Mode) · H (Next Heading) · K (Next Link)',
    },
    {
      name: 'JAWS (Job Access With Speech)',
      platform: 'Windows (Commercial / Enterprise)',
      share: '~40% Global Enterprise Market Share',
      description:
        'The enterprise standard used across corporate workplaces, banks, and government agencies. Extremely feature-rich with robust Braille display support.',
      topKey: 'Insert + F7 (List Links) · H (Next Heading) · F (Next Form Field)',
    },
    {
      name: 'Apple VoiceOver',
      platform: 'macOS, iOS, iPadOS (Built-in)',
      share: '~70% Mobile Market Share',
      description:
        'Integrated directly into Apple hardware. Uses touch gestures on iPhone/iPad and the VoiceOver Rotor (Control + Option + Keys) on Mac laptops.',
      topKey: 'VO + Left/Right Arrow · VO + U (Web Rotor Menu) · VO + Space',
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader title="Assistive tech & vision" description="Explore color perception, test contrast, and learn how screen readers navigate a page." category="Resources" icon={Glasses} onNavigate={onNavigate} />
          <div role="group" aria-label="Learning topics" className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setActiveTab('colorblind')}
              aria-pressed={activeTab === 'colorblind'}
              className={`rounded-xl px-4 py-2.5 text-[12px] font-bold transition-all ${
                activeTab === 'colorblind'
                  ? 'bg-zinc-900 text-white shadow-md dark:bg-orange-600'
                  : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              <Eye size={15} className="mr-1.5 inline" />
              Color Vision & Contrast
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('screenreaders')}
              aria-pressed={activeTab === 'screenreaders'}
              className={`rounded-xl px-4 py-2.5 text-[12px] font-bold transition-all ${
                activeTab === 'screenreaders'
                  ? 'bg-zinc-900 text-white shadow-md dark:bg-orange-600'
                  : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              <Volume2 size={15} className="mr-1.5 inline" />
              Screen Readers (Blind Users)
            </button>
          </div>

      {activeTab === 'colorblind' && (
        <>
          {/* Real-Time Interactive Color Contrast Checker */}
          <div className="workspace-panel overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-6 py-5 sm:px-8 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                  <Contrast size={22} />
                </div>
                <div>
                  <h2 className="text-[18px] font-extrabold text-zinc-900 dark:text-zinc-100">
                    Interactive WCAG Contrast Calculator
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    WCAG 2.1 Rule 1.4.3: Standard text requires at least 4.5:1. Large text requires 3:1.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 p-6 sm:p-8 lg:grid-cols-12">
              {/* Color Pickers & Inputs */}
              <div className="space-y-4 lg:col-span-5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Text (Foreground) Color:
                  </label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-300 bg-transparent p-0.5"
                    />
                    <input
                      type="text"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 font-mono text-[13px] font-bold text-zinc-800 outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Background Color:
                  </label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-300 bg-transparent p-0.5"
                    />
                    <input
                      type="text"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 font-mono text-[13px] font-bold text-zinc-800 outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Preset Fast Colors */}
                <div>
                  <span className="text-[10px] font-bold text-zinc-400">Quick Palette Presets:</span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {[
                      ['#111827', '#ffffff', 'Black on White (21:1)'],
                      ['#ffffff', '#0f172a', 'White on Navy (16:1)'],
                      ['#f97316', '#ffffff', 'Orange on White (Fail 2.9:1)'],
                      ['#c2410c', '#ffffff', 'Dark Orange (Pass 5.2:1)'],
                      ['#9ca3af', '#ffffff', 'Light Gray (Fail 2.1:1)'],
                      ['#374151', '#ffffff', 'Accessible Gray (Pass 8.5:1)'],
                    ].map(([fg, bg, label]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setTextColor(fg);
                          setBgColor(bg);
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview Box & Compliance Badges */}
              <div className="flex flex-col justify-between rounded-xl border border-zinc-200 p-6 lg:col-span-7 dark:border-zinc-700" style={{ backgroundColor: bgColor }}>
                <div>
                  <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: `${textColor}20` }}>
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: textColor }}>
                      Sample UI Preview
                    </span>
                    <span className="rounded-md px-2.5 py-1 font-mono text-sm font-black" style={{ backgroundColor: `${textColor}15`, color: textColor }}>
                      Ratio: {ratioFormatted}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <h3 className="text-[20px] font-black" style={{ color: textColor }}>
                      Accessible Digital Experiences
                    </h3>
                    <p className="text-[13px] leading-relaxed" style={{ color: textColor }}>
                      Color is powerful, but contrast is mandatory. Over 350 million color-blind people rely on sufficient luminance to read web content without strain.
                    </p>
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center rounded-lg px-4 py-2 text-[12px] font-bold shadow-sm"
                      style={{ backgroundColor: textColor, color: bgColor }}
                    >
                      Interactive Call to Action
                    </button>
                  </div>
                </div>

                {/* Compliance Result Badges */}
                <div className="mt-6 grid grid-cols-3 gap-2 border-t pt-4" style={{ borderColor: `${textColor}20` }}>
                  <div className="rounded-lg bg-white/80 p-2 text-center backdrop-blur-sm dark:bg-zinc-900/80">
                    <span className="block text-[10px] font-bold uppercase text-zinc-500">WCAG AA Regular</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-black ${passAANormal ? 'text-emerald-600' : 'text-red-600'}`}>
                      {passAANormal ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                      {passAANormal ? 'PASS (≥4.5)' : 'FAIL'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-white/80 p-2 text-center backdrop-blur-sm dark:bg-zinc-900/80">
                    <span className="block text-[10px] font-bold uppercase text-zinc-500">WCAG AA Large (18pt+)</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-black ${passAALarge ? 'text-emerald-600' : 'text-red-600'}`}>
                      {passAALarge ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                      {passAALarge ? 'PASS (≥3.0)' : 'FAIL'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-white/80 p-2 text-center backdrop-blur-sm dark:bg-zinc-900/80">
                    <span className="block text-[10px] font-bold uppercase text-zinc-500">WCAG AAA Strict</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-black ${passAAANormal ? 'text-emerald-600' : 'text-red-600'}`}>
                      {passAAANormal ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                      {passAAANormal ? 'PASS (≥7.0)' : 'FAIL'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Color Blindness Types Matrix */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-extrabold text-zinc-900 dark:text-zinc-100">
              Understanding the 5 Major Forms of Color Vision Deficiency
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {colorBlindTypes.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </h3>
                      <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase ${item.badgeTone}`}>
                        {item.commonName.split('/')[0]}
                      </span>
                    </div>

                    <span className="mt-1 block font-mono text-[10px] text-zinc-400">
                      {item.prevalence}
                    </span>

                    <p className="mt-3 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-[11px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300">
                    <strong className="block text-[10px] uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      UX Danger:
                    </strong>
                    <span className="mt-1 block leading-snug">{item.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'screenreaders' && (
        <>
          {/* Screen Reader Architecture Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {screenReaders.map((sr) => (
              <div
                key={sr.name}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                    <Volume2 size={20} />
                  </div>
                  <h3 className="mt-4 text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100">
                    {sr.name}
                  </h3>
                  <span className="block font-mono text-[10px] text-zinc-400">
                    {sr.platform} · {sr.share}
                  </span>
                  <p className="mt-3 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {sr.description}
                  </p>
                </div>

                <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <span className="block text-[10px] font-bold uppercase text-zinc-500">
                    Primary Navigation Shortcuts:
                  </span>
                  <code className="mt-1 block font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                    {sr.topKey}
                  </code>
                </div>
              </div>
            ))}
          </div>

          {/* How Blind Users Navigate & Top Engineering Guidelines */}
          <div className="workspace-panel overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-[20px] font-extrabold text-zinc-900 dark:text-zinc-100">
              How Blind Users Actually Experience the Web (The Accessibility Tree)
            </h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Screen readers like NVDA, JAWS, and Apple VoiceOver do not look at CSS styles or visual screen pixels. They parse the browser's <strong>Accessibility Tree</strong>. Blind users do not read pages top-to-bottom—they jump through landmarks, headings, and interactive elements.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-700 dark:bg-zinc-800/30">
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                  <Compass size={18} className="text-orange-500" />
                  <h3>1. Landmark Navigation</h3>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Screen reader users press <kbd className="rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">D</kbd> to jump across page sections. If your code is missing semantic HTML tags like <code>&lt;header&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>, and <code>&lt;footer&gt;</code>, blind users get trapped having to tab through 50 navbar links every single time a page loads.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-700 dark:bg-zinc-800/30">
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                  <Keyboard size={18} className="text-orange-500" />
                  <h3>2. Heading Hierarchy (H1 → H6)</h3>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Blind users press <kbd className="rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">H</kbd> to scan content headings like a table of contents. Skipping levels (e.g. going directly from <code>&lt;h1&gt;</code> to <code>&lt;h4&gt;</code>) destroys their mental model of content importance.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-700 dark:bg-zinc-800/30">
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                  <AlertTriangle size={18} className="text-orange-500" />
                  <h3>3. Accessible Names for Buttons & Links</h3>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  An icon-only button like <code>&lt;button&gt;&lt;svg&gt;&lt;/svg&gt;&lt;/button&gt;</code> is read aloud by screen readers as simply <em>"Button"</em>. Adding <code>aria-label="Close modal"</code> or visually hidden text allows assistive tech to explain what the button actually does.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-700 dark:bg-zinc-800/30">
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                  <CheckCircle2 size={18} className="text-orange-500" />
                  <h3>4. Programmatic Form Labels</h3>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  A visual label near an input does nothing for a blind user unless programmatically bound using <code>&lt;label for="email"&gt;</code> and <code>&lt;input id="email"&gt;</code>. Without this, screen readers read <em>"Edit text, blank"</em> without telling the user what field it is.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
