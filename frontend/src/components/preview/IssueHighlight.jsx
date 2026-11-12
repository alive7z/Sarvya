import { useEffect, useRef } from 'react';
import { useVision } from '../accessibility/VisionPreferences.jsx';

export default function IssueHighlight({ frameRef, selector, inspectTrigger }) {
  const { profile } = useVision();
  const previousSelector = useRef(selector);

  useEffect(() => {
    const selectionChanged = previousSelector.current !== selector;
    previousSelector.current = selector;
    const frame = frameRef?.current;
    if (!frame) return;

    let animationFrame;

    const highlight = () => {
      // Initial highlighting must not ask embedded scripts to scroll the host page.
      // Selection changes and explicit Inspect actions still activate its tooltip.
      if (selector && (selectionChanged || inspectTrigger)) {
        try {
          frame.contentWindow?.postMessage(
            { type: 'SARVYA_INSPECT', selector },
            '*'
          );
        } catch {
          // Ignore postMessage failure
        }
      }

      // 2. Direct DOM manipulation for same-origin iframe document
      let doc;
      try {
        doc = frame.contentDocument;
      } catch {
        return;
      }

      if (!doc) return;

      doc.querySelectorAll('.broken').forEach((element) => {
        element.classList.remove('broken', 'inspect-pulse');
      });

      doc.getElementById('sarvya-highlight-styles')?.remove();

      if (!selector) return;

      try {
        const elements = doc.querySelectorAll(selector);
        if (!elements.length) return;

        const style = doc.createElement('style');
        style.id = 'sarvya-highlight-styles';
        style.textContent = `
          .broken {
            outline: 4px solid #f97316 !important;
            outline-offset: 4px !important;
            border-radius: 6px !important;
            box-shadow:
              0 0 0 8px rgba(249, 115, 22, 0.2),
              0 6px 24px rgba(249, 115, 22, 0.25) !important;
            transition: outline-color 0.25s ease, box-shadow 0.25s ease !important;
          }
          @keyframes sarvya-inspect-glow {
            0% { box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.8); }
            50% { box-shadow: 0 0 0 16px rgba(249, 115, 22, 0); }
            100% { box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.8); }
          }
          .broken.inspect-pulse {
            animation: sarvya-inspect-glow 1.2s ease-in-out infinite !important;
          }
        `;
        if (profile !== 'standard') style.textContent += `
          .broken { outline: 4px dashed #111 !important; outline-offset: 4px !important;
            box-shadow: 0 0 0 4px #fff, 0 0 0 9px #fff, 0 0 0 11px #111 !important; }
          .broken.inspect-pulse { animation: none !important; }
        `;
        doc.head?.appendChild(style);

        elements.forEach((element) => {
          element.classList.add('broken', 'inspect-pulse');
        });

        animationFrame = requestAnimationFrame(() => {
          const target = elements[0];
          const previewWindow = doc.defaultView;
          if (!target || !previewWindow) return;
          const rect = target.getBoundingClientRect();
          // scrollIntoView can traverse iframe boundaries. Scroll only this document.
          previewWindow.scrollTo({
            top: Math.max(0, previewWindow.scrollY + rect.top - (previewWindow.innerHeight - rect.height) / 2),
            left: Math.max(0, previewWindow.scrollX + rect.left - (previewWindow.innerWidth - rect.width) / 2),
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'instant'
              : 'smooth',
          });
        });

        setTimeout(() => {
          elements.forEach((element) => {
            element.classList.remove('inspect-pulse');
          });
        }, 3500);
      } catch {
        // Ignore selector errors
      }
    };

    frame.addEventListener('load', highlight);
    highlight();

    return () => {
      frame.removeEventListener('load', highlight);
      cancelAnimationFrame(animationFrame);

      try {
        const doc = frame.contentDocument;
        doc?.querySelectorAll('.broken').forEach((element) => {
          element.classList.remove('broken', 'inspect-pulse');
        });
        doc?.getElementById('sarvya-highlight-styles')?.remove();
      } catch {
        // Ignore
      }
    };
  }, [frameRef, selector, inspectTrigger, profile]);

  return null;
}
