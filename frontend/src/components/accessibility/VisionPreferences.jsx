import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, Check, CircleHelp, Eye, ShieldCheck, TriangleAlert } from 'lucide-react';

export const VISION_KEY = 'sarvya-vision-v1';
export const visionOptions = [
  ['standard', 'No, use the original colours', 'Keep the familiar Sarvya appearance.'],
  ['protan', 'Red–green · protan', 'For protanopia or protanomaly (red sensitivity).'],
  ['deutan', 'Red–green · deutan', 'For deuteranopia or deuteranomaly (green sensitivity).'],
  ['tritan', 'Blue–yellow · tritan', 'For tritanopia or tritanomaly.'],
  ['mono', 'Monochrome', 'For achromatopsia, or if you prefer no colour cues.'],
  ['unsure', 'Not sure · stronger contrast', 'A clear, neutral interface with labelled indicators.'],
];
const VisionContext = createContext(null);
export const useVision = () => useContext(VisionContext);
function readPreference() {
  try { const value = localStorage.getItem(VISION_KEY); return visionOptions.some(([id]) => id === value) ? value : null; } catch { return null; }
}
export function VisionProvider({ children }) {
  const [profile, setProfile] = useState(() => readPreference() || 'standard');
  const [open, setOpen] = useState(() => !readPreference());
  const [entered, setEntered] = useState(() => Boolean(readPreference()));
  const [storageError, setStorageError] = useState(false);
  const returnFocus = useRef(null);
  const finish = (value) => {
    setProfile(value);
    try { localStorage.setItem(VISION_KEY, value); setStorageError(false); } catch { setStorageError(true); }
    setEntered(true);
    setOpen(false);
    requestAnimationFrame(() => { window.scrollTo(0, 0); (returnFocus.current?.isConnected ? returnFocus.current : document.querySelector('.app-topbar button'))?.focus({ preventScroll: true }); });
  };
  const edit = () => { returnFocus.current = document.activeElement; setOpen(true); window.scrollTo(0, 0); };
  return <VisionContext.Provider value={{ profile, open, edit }}>
    <div data-vision={profile}>
      {open && <VisionWelcome initial={profile} onFinish={finish} />}
      {entered && <div hidden={open}>{children}</div>}
      {storageError && !open && <p role="status" className="vision-storage-note">Your colour preference is active for this visit. This browser could not save it.</p>}
    </div>
  </VisionContext.Provider>;
}
function VisionWelcome({ initial, onFinish }) {
  const [choice, setChoice] = useState(initial);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <main className="vision-welcome" data-vision={choice}>
    <div className="vision-welcome-inner">
      <div className="vision-brand"><Activity aria-hidden="true" size={24} /><span>Sar<span>vya</span></span></div>
      <div className="vision-intro"><span className="vision-eyebrow">A workspace that works for you</span>
        <h1 ref={heading} tabIndex={-1}>Are you colour blind?</h1>
        <p>Choose the colours that feel clearest to you. We’ll adapt your workspace, while keeping every status understandable through words and shapes.</p>
      </div>
      <div className="vision-setup-grid">
        <form onSubmit={event => { event.preventDefault(); onFinish(choice); }}>
          <fieldset><legend>Your colour vision preference</legend><div className="vision-options">
            {visionOptions.map(([id, title, description]) => <label key={id} className={`vision-option ${choice === id ? 'is-selected' : ''}`}>
              <input type="radio" name="vision" value={id} checked={choice === id} onChange={() => setChoice(id)} />
              <span><strong>{title}</strong><small>{description}</small></span>{choice === id && <Check size={18} aria-hidden="true" />}
            </label>)}
          </div></fieldset>
          <button type="submit" className="vision-continue">Continue to workspace <ArrowRight size={18} aria-hidden="true" /></button>
          <button type="button" className="vision-skip" onClick={() => onFinish('standard')}>Skip and use original colours</button>
        </form>
        <aside className="vision-preview" aria-label="Colour preference preview">
          <div className="vision-preview-heading"><Eye size={20} aria-hidden="true" /><span>Preview your workspace</span></div>
          <h2>Clear at a glance.</h2><p>Colour supports the message. It never has to carry it alone.</p>
          <div className="vision-demo-status vision-demo-critical"><TriangleAlert size={20} aria-hidden="true" /><span><strong>Critical issue</strong><small>Needs immediate attention</small></span><b>3</b></div>
          <div className="vision-demo-status vision-demo-success"><ShieldCheck size={20} aria-hidden="true" /><span><strong>Verified fix</strong><small>Passed the verification check</small></span><b>2</b></div>
          <div className="vision-demo-chart"><span>Sample progress</span><strong>60%</strong><div><i /></div></div>
          <p className="vision-preview-note">Illustrative preview · no scan results</p>
          <div className="vision-reassurance"><CircleHelp size={18} aria-hidden="true" /><p>No diagnosis or colour test is needed. Your selection stays in this browser. Change it anytime with the Colour preferences button in the header. Audited websites keep their original colours.</p></div>
        </aside>
      </div>
    </div>
  </main>;
}
