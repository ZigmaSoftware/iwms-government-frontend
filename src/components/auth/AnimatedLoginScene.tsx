import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Purely decorative animated background for the login page: waves, a city
 * skyline, orbiting particles, drifting/falling leaves, a wind-shaken tree,
 * a truck, a wifi beacon, and two clickable recycling bins.
 * Ported from zigma-login-animated-v3.html. `containerRef` must point at the
 * `.zigma-login` wrapper — parallax offsets and the reduced-motion pause
 * class are written onto it instead of `<html>`/`<body>` so effects stay
 * scoped to this component instance.
 */
export default function AnimatedLoginScene({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [binGreenOpen, setBinGreenOpen] = useState(false);
  const [binBlueOpen, setBinBlueOpen] = useState(false);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onVisibility = () => {
      root.classList.toggle("is-paused", document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibility);

    const desktop = window.matchMedia("(min-width: 1025px)");
    let tX = 0, tY = 0, cX = 0, cY = 0, running = false;

    function frame() {
      const dx = tX - cX, dy = tY - cY;
      if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) {
        cX = tX; cY = tY;
        root!.style.setProperty("--px", cX.toFixed(3));
        root!.style.setProperty("--py", cY.toFixed(3));
        running = false;
        return;
      }
      cX += dx * 0.07;
      cY += dy * 0.07;
      root!.style.setProperty("--px", cX.toFixed(3));
      root!.style.setProperty("--py", cY.toFixed(3));
      requestAnimationFrame(frame);
    }

    function onMove(e: MouseEvent) {
      if (!desktop.matches) return;
      tX = (e.clientX / window.innerWidth - 0.5) * -14;
      tY = (e.clientY / window.innerHeight - 0.5) * -9;
      if (!running) { running = true; requestAnimationFrame(frame); }
    }

    if (!reduced) window.addEventListener("mousemove", onMove, { passive: true });

    const onDesktopChange = () => {
      if (!desktop.matches) {
        tX = tY = cX = cY = 0;
        root!.style.setProperty("--px", "0");
        root!.style.setProperty("--py", "0");
      }
    };
    desktop.addEventListener("change", onDesktopChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("mousemove", onMove);
      desktop.removeEventListener("change", onDesktopChange);
    };
  }, [containerRef]);

  return (
    <>
      <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }} focusable="false">
        <defs>
          <path id="rec-arm" d="M36.05 38.3 L48 17.5 Q50 14 52 17.5 L69.2 33.1 L63.6 50.7 L45.5 46.7 L51.7 43.2 L50 40.2 L47.3 44.8 Z" />
          <path id="rec-fold" d="M36.05 38.3 L47.3 44.8 L43.6 51.2 L32.4 44.7 Z" />

          <symbol id="recycle" viewBox="0 0 100 100">
            <g strokeLinejoin="round">
              <use href="#rec-fold" fill="currentColor" opacity=".38" />
              <use href="#rec-arm" fill="currentColor" opacity=".95" />
              <g transform="rotate(120 50 50)">
                <use href="#rec-fold" fill="currentColor" opacity=".28" />
                <use href="#rec-arm" fill="currentColor" opacity=".78" />
              </g>
              <g transform="rotate(240 50 50)">
                <use href="#rec-fold" fill="currentColor" opacity=".22" />
                <use href="#rec-arm" fill="currentColor" opacity=".6" />
              </g>
            </g>
          </symbol>

          <symbol id="leaf" viewBox="0 0 32 32">
            <path d="M27.4 4.2C13.6 4.6 5.2 10.9 5.2 20.1c0 2 .4 3.8 1.2 5.4C8.6 18.6 13.4 13.9 20 11.2c-6 3.8-9.7 9-10.8 15 12.9 1.5 19.6-7.6 18.2-22Z" fill="currentColor" />
            <path d="M9.5 26.3C11.6 18.8 15.6 13.4 21.6 9.5" stroke="rgba(255,255,255,.75)" strokeWidth="1.1" fill="none" strokeLinecap="round" />
            <path d="M12.6 20.9c1.6-.9 3.4-1.3 5.4-1.2M15.9 15.9c1.4-1 3-1.6 4.9-1.9" stroke="rgba(255,255,255,.5)" strokeWidth=".9" fill="none" strokeLinecap="round" />
          </symbol>
        </defs>
      </svg>

      <div className="scene" aria-hidden="true">
        <div className="plx waves">
          <svg viewBox="0 0 2400 400" preserveAspectRatio="none">
            <path className="wave-a" fill="#eef4f8" opacity=".75"
              d="M0 250 C150 200 450 200 600 250 C750 300 1050 300 1200 250 C1350 200 1650 200 1800 250 C1950 300 2250 300 2400 250 L2400 400 L0 400 Z" />
            <path className="wave-b" fill="#f2f7f3" opacity=".85"
              d="M0 305 C100 270 300 270 400 305 C500 340 700 340 800 305 C900 270 1100 270 1200 305 C1300 340 1500 340 1600 305 C1700 270 1900 270 2000 305 C2100 340 2300 340 2400 305 L2400 400 L0 400 Z" />
          </svg>
        </div>

        <div className="plx city">
          <svg viewBox="0 0 1600 420" preserveAspectRatio="xMidYMax meet">
            <g fill="var(--city-2)">
              <rect x="180" y="230" width="70" height="190" /><rect x="262" y="268" width="52" height="152" />
              <rect x="330" y="205" width="64" height="215" /><rect x="1180" y="240" width="60" height="180" />
              <rect x="1252" y="278" width="48" height="142" /><rect x="1312" y="222" width="70" height="198" />
            </g>
            <g fill="var(--city)">
              <rect x="222" y="290" width="46" height="130" /><rect x="284" y="196" width="56" height="224" />
              <rect x="352" y="255" width="42" height="165" /><rect x="404" y="150" width="58" height="270" />
              <rect x="424" y="120" width="18" height="34" /><rect x="472" y="218" width="48" height="202" />
              <rect x="530" y="176" width="66" height="244" /><rect x="606" y="248" width="44" height="172" />
              <rect x="660" y="128" width="54" height="292" /><rect x="678" y="96" width="16" height="36" />
              <rect x="724" y="212" width="60" height="208" /><rect x="794" y="262" width="40" height="158" />
              <rect x="844" y="168" width="62" height="252" /><rect x="916" y="232" width="50" height="188" />
              <rect x="976" y="140" width="56" height="280" /><rect x="994" y="108" width="18" height="36" />
              <rect x="1042" y="244" width="46" height="176" /><rect x="1098" y="192" width="60" height="228" />
              <rect x="1168" y="266" width="42" height="154" /><rect x="1220" y="182" width="58" height="238" />
              <rect x="1288" y="252" width="48" height="168" /><rect x="1346" y="206" width="64" height="214" />
              <rect x="1420" y="272" width="44" height="148" />
            </g>
            <g fill="#fff" opacity=".55">
              <rect x="418" y="176" width="10" height="14" /><rect x="438" y="176" width="10" height="14" />
              <rect x="418" y="206" width="10" height="14" /><rect x="438" y="206" width="10" height="14" />
              <rect x="674" y="156" width="10" height="14" /><rect x="694" y="156" width="10" height="14" />
              <rect x="674" y="186" width="10" height="14" /><rect x="694" y="186" width="10" height="14" />
              <rect x="990" y="168" width="10" height="14" /><rect x="1010" y="168" width="10" height="14" />
              <rect x="860" y="196" width="10" height="14" /><rect x="880" y="196" width="10" height="14" />
            </g>
          </svg>
        </div>
        <div className="plx ground"></div>

        <div className="plx orbits">
          <svg viewBox="0 0 1100 700" preserveAspectRatio="xMidYMid meet">
            <ellipse className="orbit-path" cx="560" cy="330" rx="500" ry="278" transform="rotate(-9 560 330)" />
            <ellipse className="orbit-path slow" cx="560" cy="300" rx="372" ry="196" transform="rotate(7 560 300)" />
            <ellipse className="orbit-path" cx="560" cy="238" rx="214" ry="118" transform="rotate(-14 560 238)" />

            <circle className="node" cx="72" cy="316" r="4.5" />
            <circle className="node" cx="196" cy="150" r="4.5" style={{ animationDelay: "-.5s" }} />
            <circle className="node" cx="330" cy="70" r="4.5" style={{ animationDelay: "-1.1s" }} />
            <circle className="node" cx="806" cy="46" r="4.5" style={{ animationDelay: "-1.7s" }} />
            <circle className="node" cx="960" cy="118" r="4.5" style={{ animationDelay: "-2.3s" }} />
            <circle className="node" cx="968" cy="404" r="4.5" style={{ animationDelay: "-2.9s" }} />
            <circle className="node" cx="540" cy="474" r="4.5" style={{ animationDelay: "-1.4s" }} />
            <circle className="node" cx="66" cy="500" r="4.5" style={{ animationDelay: "-2.1s" }} />
            <circle className="node ring" cx="382" cy="122" r="9" />
            <circle className="node ring" cx="746" cy="152" r="7" style={{ animationDelay: "-1.3s" }} />

            <g className="hero-halo">
              <circle cx="530" cy="140" r="86" fill="#fff" opacity=".85" />
              <circle cx="530" cy="140" r="86" fill="none" stroke="#e4f1e8" strokeWidth="2" />
              <circle cx="530" cy="140" r="112" fill="none" stroke="#eef5f0" strokeWidth="16" opacity=".6" />
            </g>
            <g className="hero-mark" style={{ color: "var(--brand-500)" }}>
              <use href="#recycle" x="466" y="76" width="128" height="128" opacity=".72" />
            </g>
          </svg>
        </div>

        <div className="plx leaves">
          <span className="drifter" style={{ left: "5.5%", top: "41%", color: "#4fb96d", animationDuration: "11s" }}>
            <span className="spin" style={{ animationDuration: "9s" }}><svg viewBox="0 0 32 32" width="36" height="36"><use href="#leaf" /></svg></span></span>
          <span className="drifter" style={{ left: "38.5%", top: "24%", color: "#63c47e", animationDuration: "9.5s", animationDelay: "-2s" }}>
            <span className="spin" style={{ animationDuration: "12s" }}><svg viewBox="0 0 32 32" width="30" height="30"><use href="#leaf" /></svg></span></span>
          <span className="drifter" style={{ left: "53.5%", top: "39%", color: "#8ecf9f", animationDuration: "12.5s", animationDelay: "-4s" }}>
            <span className="spin" style={{ animationDuration: "10s" }}><svg viewBox="0 0 32 32" width="26" height="26"><use href="#leaf" /></svg></span></span>
          <span className="drifter" style={{ left: "57.5%", top: "4.5%", color: "#4fb96d", animationDuration: "10.5s", animationDelay: "-1.2s" }}>
            <span className="spin" style={{ animationDuration: "14s" }}><svg viewBox="0 0 32 32" width="32" height="32"><use href="#leaf" /></svg></span></span>
          <span className="drifter" style={{ left: "72%", top: "6%", color: "#9ed3ab", animationDuration: "13s", animationDelay: "-5.5s" }}>
            <span className="spin" style={{ animationDuration: "8s" }}><svg viewBox="0 0 32 32" width="24" height="24"><use href="#leaf" /></svg></span></span>
          <span className="drifter" style={{ left: "59%", top: "52%", color: "#6cc386", animationDuration: "9s", animationDelay: "-3.2s" }}>
            <span className="spin" style={{ animationDuration: "11s" }}><svg viewBox="0 0 32 32" width="28" height="28"><use href="#leaf" /></svg></span></span>
          <span className="drifter" style={{ left: "22%", top: "12%", color: "#a8d8b4", animationDuration: "10s", animationDelay: "-7s" }}>
            <span className="spin" style={{ animationDuration: "13s" }}><svg viewBox="0 0 32 32" width="22" height="22"><use href="#leaf" /></svg></span></span>
        </div>

        <div className="plx fallers">
          <span className="faller" style={{ left: "8%", animationDuration: "17s", animationDelay: "-3s" }}>
            <span className="sway" style={{ animationDuration: "3.8s" }}>
              <span className="spin" style={{ animationDuration: "5.6s" }}><svg viewBox="0 0 32 32" width="26" height="26" style={{ color: "#5cbf79" }}><use href="#leaf" /></svg></span></span></span>
          <span className="faller" style={{ left: "15%", animationDuration: "22s", animationDelay: "-11s" }}>
            <span className="sway" style={{ animationDuration: "4.6s", animationDelay: "-1s" }}>
              <span className="spin" style={{ animationDuration: "7.4s" }}><svg viewBox="0 0 32 32" width="20" height="20" style={{ color: "#8ccf9d" }}><use href="#leaf" /></svg></span></span></span>
          <span className="faller" style={{ left: "27%", animationDuration: "19s", animationDelay: "-7s" }}>
            <span className="sway" style={{ animationDuration: "3.1s", animationDelay: "-2s" }}>
              <span className="spin" style={{ animationDuration: "6.2s" }}><svg viewBox="0 0 32 32" width="24" height="24" style={{ color: "#a8c25e" }}><use href="#leaf" /></svg></span></span></span>
          <span className="faller" style={{ left: "36%", animationDuration: "25s", animationDelay: "-16s" }}>
            <span className="sway" style={{ animationDuration: "5.2s" }}>
              <span className="spin" style={{ animationDuration: "9s" }}><svg viewBox="0 0 32 32" width="18" height="18" style={{ color: "#6cc386" }}><use href="#leaf" /></svg></span></span></span>
          <span className="faller" style={{ left: "47%", animationDuration: "20s", animationDelay: "-2s" }}>
            <span className="sway" style={{ animationDuration: "4.1s", animationDelay: "-1.5s" }}>
              <span className="spin" style={{ animationDuration: "6.8s" }}><svg viewBox="0 0 32 32" width="27" height="27" style={{ color: "#4fb96d" }}><use href="#leaf" /></svg></span></span></span>
          <span className="faller" style={{ left: "58%", animationDuration: "23s", animationDelay: "-13s" }}>
            <span className="sway" style={{ animationDuration: "3.6s" }}>
              <span className="spin" style={{ animationDuration: "8.2s" }}><svg viewBox="0 0 32 32" width="21" height="21" style={{ color: "#9ed3ab" }}><use href="#leaf" /></svg></span></span></span>
          <span className="faller" style={{ left: "67%", animationDuration: "18s", animationDelay: "-9s" }}>
            <span className="sway" style={{ animationDuration: "4.9s", animationDelay: "-2.5s" }}>
              <span className="spin" style={{ animationDuration: "5.9s" }}><svg viewBox="0 0 32 32" width="23" height="23" style={{ color: "#b6c96a" }}><use href="#leaf" /></svg></span></span></span>
          <span className="faller" style={{ left: "76%", animationDuration: "26s", animationDelay: "-19s" }}>
            <span className="sway" style={{ animationDuration: "3.3s" }}>
              <span className="spin" style={{ animationDuration: "10s" }}><svg viewBox="0 0 32 32" width="17" height="17" style={{ color: "#8ccf9d" }}><use href="#leaf" /></svg></span></span></span>
        </div>

        <div className="plx flora">
          <svg viewBox="0 0 300 340">
            <g className="tree" style={{ transformOrigin: "150px 300px", transformBox: "fill-box" }}>
              <g className="canopy top" style={{ transformOrigin: "150px 200px", transformBox: "fill-box" }}>
                <ellipse cx="150" cy="92" rx="86" ry="66" fill="#cfe9d4" opacity=".85" />
              </g>
              <g className="canopy mid" style={{ transformOrigin: "150px 210px", transformBox: "fill-box" }}>
                <ellipse cx="98" cy="126" rx="62" ry="48" fill="#dcf0df" opacity=".9" />
                <ellipse cx="204" cy="122" rx="58" ry="44" fill="#dcf0df" opacity=".9" />
              </g>
              <g className="canopy" style={{ transformOrigin: "150px 220px", transformBox: "fill-box" }}>
                <ellipse cx="150" cy="132" rx="72" ry="52" fill="#c6e5cc" opacity=".7" />
              </g>
              <path d="M150 300 L150 150 M150 196 L108 154 M150 214 L192 172 M150 246 L118 214 M150 236 L186 206"
                stroke="#8fae95" strokeWidth="5" fill="none" strokeLinecap="round" />
              <path d="M142 300 h16" stroke="#8fae95" strokeWidth="6" strokeLinecap="round" />
            </g>
            <g className="shrub" style={{ transformOrigin: "52px 320px", transformBox: "fill-box" }}>
              <ellipse cx="42" cy="298" rx="44" ry="30" fill="#d8efdc" />
              <ellipse cx="76" cy="306" rx="34" ry="24" fill="#cae7d0" />
            </g>
            <ellipse cx="150" cy="316" rx="96" ry="9" fill="#dfeee2" opacity=".7" />
          </svg>
        </div>

        <div className="plx truck-slot">
          <div className="truck-enter"><div className="truck-bob">
            <svg viewBox="0 0 560 300">
              <g className="speed" stroke="#4cb96b" strokeWidth="4.5" strokeLinecap="round">
                <path d="M6 118 H92" opacity=".9" /><path d="M26 152 H108" opacity=".7" />
                <path d="M2 186 H74" opacity=".55" /><path d="M34 218 H96" opacity=".4" />
              </g>
              <path d="M96 96 v128 M96 96 h22 M96 224 h22" fill="none" stroke="#1f8a44" strokeWidth="6" strokeLinecap="round" />
              <rect x="118" y="74" width="252" height="152" rx="10" fill="#fff" stroke="#1f8a44" strokeWidth="5" />
              <rect x="124" y="58" width="240" height="20" rx="10" fill="#fff" stroke="#1f8a44" strokeWidth="5" />
              <rect x="118" y="196" width="252" height="30" rx="6" fill="#2f9e4f" />
              <path d="M150 84 v106" stroke="#cfeacf" strokeWidth="4" />
              <rect x="176" y="186" width="34" height="18" rx="4" fill="#8fd7a4" opacity=".7" />
              <g className="truck-mark" style={{ color: "#2f9e4f" }}>
                <use href="#recycle" x="208" y="86" width="104" height="104" />
              </g>
              <path d="M372 92 h44 q12 0 19 10 l38 58 q7 10 7 22 v44 h-108 Z"
                fill="#fff" stroke="#1f8a44" strokeWidth="5" strokeLinejoin="round" />
              <path d="M382 104 h34 q7 0 11 6 l30 46 h-75 Z" fill="#eaf7ee" stroke="#7cc894" strokeWidth="3" />
              <rect x="372" y="196" width="108" height="30" rx="4" fill="#2f9e4f" />
              <path d="M376 168 h10" stroke="#1f8a44" strokeWidth="6" strokeLinecap="round" />
              <rect x="112" y="226" width="374" height="14" rx="7" fill="#1f7a3f" />
              <g className="wheel">
                <circle cx="212" cy="252" r="40" fill="#2c3a3f" />
                <circle cx="212" cy="252" r="24" fill="#fff" />
                <circle cx="212" cy="252" r="13" fill="#2f9e4f" />
              </g>
              <g className="wheel" style={{ animationDelay: ".45s" }}>
                <circle cx="428" cy="252" r="40" fill="#2c3a3f" />
                <circle cx="428" cy="252" r="24" fill="#fff" />
                <circle cx="428" cy="252" r="13" fill="#2f9e4f" />
              </g>
              <ellipse cx="310" cy="294" rx="200" ry="7" fill="#dfeee2" opacity=".8" />
            </svg>
          </div></div>
        </div>

        <div className="plx wifi">
          <svg viewBox="0 0 100 80">
            <g fill="none" stroke="#2f9e4f" strokeLinecap="round">
              <circle className="wave-arc" cx="50" cy="68" r="5" fill="#2f9e4f" stroke="none" />
              <path className="wave-arc" d="M34 52 a22 22 0 0 1 32 0" strokeWidth="8" />
              <path className="wave-arc" d="M20 36 a42 42 0 0 1 60 0" strokeWidth="8" />
              <path className="wave-arc" d="M8 21 a60 60 0 0 1 84 0" strokeWidth="8" />
            </g>
          </svg>
        </div>
      </div>

      <div className="plx bins">
        <button
          type="button"
          className="bin"
          aria-pressed={binGreenOpen}
          aria-label={binGreenOpen ? "Close the recyclables bin" : "Open the recyclables bin"}
          onClick={() => setBinGreenOpen((v) => !v)}
        >
          <svg viewBox="0 0 120 200">
            <ellipse className="halo" cx="60" cy="180" rx="52" ry="9" fill="#3cb95f" opacity=".18" />
            <g className="toss" style={{ color: "#3cb95f" }}>
              <use href="#recycle" x="38" y="6" width="44" height="44" opacity="0" />
            </g>
            <g className="body">
              <path className="mouth" d="M22 74 h74 l-3 16 h-68 Z" fill="#1b6b35" opacity=".18" />
              <path d="M22 74 h74 l-7 92 a9 9 0 0 1 -9 8 h-42 a9 9 0 0 1 -9 -8 Z"
                fill="#fff" stroke="#2f9e4f" strokeWidth="4.5" strokeLinejoin="round" />
              <path d="M42 88 l-4 76 M76 88 l4 76" stroke="#cfeacf" strokeWidth="3.5" fill="none" />
              <g className="bin-mark" style={{ color: "#3cb95f" }}><use href="#recycle" x="36" y="96" width="48" height="48" /></g>
            </g>
            <g className="lid">
              <rect x="46" y="30" width="26" height="12" rx="6" fill="#fff" stroke="#2f9e4f" strokeWidth="4.5" />
              <path d="M22 54 h74 a8 8 0 0 1 8 8 v8 H14 v-8 a8 8 0 0 1 8 -8 Z"
                fill="#fff" stroke="#2f9e4f" strokeWidth="4.5" strokeLinejoin="round" />
            </g>
            <circle cx="36" cy="182" r="8" fill="none" stroke="#2f9e4f" strokeWidth="4" />
            <circle cx="84" cy="182" r="8" fill="none" stroke="#2f9e4f" strokeWidth="4" />
          </svg>
        </button>

        <button
          type="button"
          className="bin"
          aria-pressed={binBlueOpen}
          aria-label={binBlueOpen ? "Close the dry waste bin" : "Open the dry waste bin"}
          onClick={() => setBinBlueOpen((v) => !v)}
        >
          <svg viewBox="0 0 120 200">
            <ellipse className="halo" cx="60" cy="180" rx="52" ry="9" fill="#3b82c4" opacity=".18" />
            <g className="body">
              <path className="mouth" d="M22 74 h74 l-3 16 h-68 Z" fill="#1d4f7d" opacity=".18" />
              <path d="M22 74 h74 l-7 92 a9 9 0 0 1 -9 8 h-42 a9 9 0 0 1 -9 -8 Z"
                fill="#fff" stroke="#3b82c4" strokeWidth="4.5" strokeLinejoin="round" />
              <path d="M42 88 l-4 76 M76 88 l4 76" stroke="#d6e7f6" strokeWidth="3.5" fill="none" />
              <g className="bin-mark" style={{ color: "#5b9fd8" }}><use href="#recycle" x="36" y="96" width="48" height="48" /></g>
            </g>
            <g className="lid">
              <rect x="46" y="30" width="26" height="12" rx="6" fill="#fff" stroke="#3b82c4" strokeWidth="4.5" />
              <path d="M22 54 h74 a8 8 0 0 1 8 8 v8 H14 v-8 a8 8 0 0 1 8 -8 Z"
                fill="#fff" stroke="#3b82c4" strokeWidth="4.5" strokeLinejoin="round" />
            </g>
            <circle cx="36" cy="182" r="8" fill="none" stroke="#3b82c4" strokeWidth="4" />
            <circle cx="84" cy="182" r="8" fill="none" stroke="#3b82c4" strokeWidth="4" />
          </svg>
        </button>
      </div>
    </>
  );
}
