import { useEffect, useRef, type RefObject } from "react";

/**
 * The four feature discs (Real-Time Tracking / IoT Sensors / Analytics &
 * Reports / Smart Dashboard) wired together by an animated "data chain".
 * Ported from zigma-login-animated-v3.html. `containerRef` must point at
 * the `.zigma-login` wrapper — the measured chain length is written there
 * as `--chain-len` so the packet-travel animation can read it via var().
 */
export default function LoginFeatureChain({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const chainRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const chain = chainRef.current;
    const root = containerRef.current;
    if (!chain || !root) return;

    const measure = () => {
      root.style.setProperty("--chain-len", `${chain.getBoundingClientRect().width.toFixed(1)}px`);
    };
    measure();

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(measure);
      ro.observe(chain);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [containerRef]);

  return (
    <ul className="features">
      <li className="chain" aria-hidden="true" ref={chainRef}>
        <svg preserveAspectRatio="none" viewBox="0 0 100 2"><line className="chain-line" x1="0" y1="1" x2="100" y2="1" vectorEffect="non-scaling-stroke" /></svg>
        <span className="packet"></span><span className="packet"></span><span className="packet"></span>
      </li>

      <li className="feature">
        <span className="feature-btn" aria-hidden="true">
          <svg className="feature-ring" viewBox="0 0 104 104"><circle cx="52" cy="52" r="50" /></svg>
          <span className="feature-disc">
            <svg viewBox="0 0 24 24">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="currentColor" />
              <circle cx="12" cy="10" r="3" fill="#fff" />
            </svg>
          </span>
        </span>
        <p className="feature-title">Real-Time<br />Tracking</p>
      </li>

      <li className="feature">
        <span className="feature-btn" aria-hidden="true">
          <svg className="feature-ring" viewBox="0 0 104 104"><circle cx="52" cy="52" r="50" /></svg>
          <span className="feature-disc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M3.5 8.5a14 14 0 0 1 17 0" /><path d="M6.5 12.6a9.5 9.5 0 0 1 11 0" />
              <path d="M9.4 16.6a5 5 0 0 1 5.2 0" />
              <circle cx="12" cy="20" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </span>
        </span>
        <p className="feature-title">IoT<br />Sensors</p>
      </li>

      <li className="feature">
        <span className="feature-btn" aria-hidden="true">
          <svg className="feature-ring" viewBox="0 0 104 104"><circle cx="52" cy="52" r="50" /></svg>
          <span className="feature-disc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor" stroke="none" />
              <rect x="9.5" y="9" width="4" height="12" rx="1" fill="currentColor" stroke="none" />
              <rect x="16" y="5" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
              <path d="M4 9.5 9 6l4 2.5L20 3" /><path d="M16.5 3H20v3.5" />
            </svg>
          </span>
        </span>
        <p className="feature-title">Analytics &amp;<br />Reports</p>
      </li>

      <li className="feature">
        <span className="feature-btn" aria-hidden="true">
          <svg className="feature-ring" viewBox="0 0 104 104"><circle cx="52" cy="52" r="50" /></svg>
          <span className="feature-disc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="4" width="19" height="13" rx="2" />
              <path d="M9 21h6M12 17v4" />
              <path d="M6.5 13 10 9.5l2.4 2.4L17.5 7" /><path d="M14.6 7h2.9v2.9" />
            </svg>
          </span>
        </span>
        <p className="feature-title">Smart<br />Dashboard</p>
      </li>
    </ul>
  );
}
