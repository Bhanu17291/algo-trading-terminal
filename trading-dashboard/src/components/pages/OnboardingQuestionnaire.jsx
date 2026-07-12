import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Shares the same design tokens as LandingPage.jsx.
// If you already extract T into a shared theme file, import it from there instead.
const T = {
  bg:        "#040A06",
  surface:   "#0D1A13",
  border:    "rgba(34,197,94,0.1)",
  borderMd:  "rgba(34,197,94,0.2)",
  green:     "#22C55E",
  greenDim:  "#16A34A",
  mint:      "#86EFAC",
  pale:      "#BBF7D0",
  text:      "#E7F0EA",
  textDim:   "rgba(231,240,234,0.55)",
  textFaint: "rgba(231,240,234,0.25)",
  red:       "#F87171",
  amber:     "#FBBF24",
  blue:      "#60A5FA",
  mono:      "'JetBrains Mono','Fira Code','Courier New',monospace",
  sans:      "'Inter','Segoe UI',system-ui,sans-serif",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Each option carries a "weight": positive = aggressive/QUANT-leaning, negative = conservative/MACRO-leaning.
const STEPS = [
  {
    id: "name",
    type: "text",
    title: "First, what should we call you?",
    sub: "Just your first name is fine.",
    placeholder: "e.g. Priya",
    validate: (v) => {
      if (!v || !v.trim()) return "Name is required.";
      if (v.trim().length < 2) return "That name looks too short.";
      return null;
    },
  },
  {
    id: "email",
    type: "text",
    inputType: "email",
    title: "Where should signal alerts go?",
    sub: "We'll only use this for your daily BUY/HOLD call.",
    placeholder: "you@example.com",
    validate: (v) => {
      if (!v || !v.trim()) return "Email is required.";
      if (!EMAIL_RE.test(v.trim())) return "Enter a valid email address.";
      return null;
    },
  },
  {
    id: "experience",
    type: "select",
    title: "How long have you been trading?",
    sub: "This helps calibrate how much detail we show you.",
    options: [
      { label: "New to this",        weight: -1 },
      { label: "A few years",         weight: 0  },
      { label: "5+ years, active",    weight: 1  },
    ],
    validate: (v) => (v === undefined || v === null ? "Pick one to continue." : null),
  },
  {
    id: "risk",
    type: "select",
    title: "How do you feel about drawdowns?",
    sub: "Be honest — this shapes which profile fits you.",
    options: [
      { label: "Avoid them at all costs",     weight: -1 },
      { label: "Some dips are fine",          weight: 0  },
      { label: "I can stomach big swings",    weight: 1  },
    ],
    validate: (v) => (v === undefined || v === null ? "Pick one to continue." : null),
  },
  {
    id: "goal",
    type: "select",
    title: "What's the goal here?",
    sub: "Almost done.",
    options: [
      { label: "Protect what I have",      weight: -1 },
      { label: "Steady, compounding growth", weight: 0 },
      { label: "Maximize returns",          weight: 1  },
    ],
    validate: (v) => (v === undefined || v === null ? "Pick one to continue." : null),
  },
  {
    id: "amount",
    type: "amount",
    title: "How much are you looking to invest?",
    sub: "This is just to show you a projected outcome — you can change it any time.",
    min: 15000,
    max: 500000,
    step: 5000,
    default: 100000,
    validate: (v) => {
      const amt = v ?? 100000;
      if (amt < 15000 || amt > 500000) return "Enter an amount between ₹15,000 and ₹5,00,000.";
      return null;
    },
  },
];

export default function OnboardingQuestionnaire() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState(null);
  const [hovOpt, setHovOpt] = useState(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const setAnswer = (val) => {
    setAnswers((a) => ({ ...a, [current.id]: val }));
    if (error) setError(null);
  };

  const computeProfile = (finalAnswers) => {
    const score = STEPS
      .filter((s) => s.type === "select")
      .reduce((sum, s) => {
        const chosen = finalAnswers[s.id];
        const opt = s.options[chosen];
        return sum + (opt ? opt.weight : 0);
      }, 0);
    // score range roughly -3..+3
    return score > 0 ? "QUANT" : score < 0 ? "MACRO" : "BALANCED";
  };

  const goNext = () => {
    const val = answers[current.id];
    const err = current.validate(val);
    if (err) { setError(err); return; }

    if (isLast) {
      const profile = computeProfile(answers);
      const investmentAmount = answers.amount ?? 100000;
      navigate("/strategies", {
        state: {
          customerProfile: profile,
          investmentAmount,
          onboarding: { name: answers.name, email: answers.email },
        },
      });
      return;
    }
    setStep((s) => s + 1);
    setError(null);
  };

  const goBack = () => {
    if (step === 0) return;
    setStep((s) => s - 1);
    setError(null);
  };

  const skip = () => navigate("/dashboard");

  const s = {
    root: {
      minHeight: "100vh", background: T.bg, color: T.text,
      fontFamily: T.sans, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    },
    card: {
      width: "100%", maxWidth: 460,
      background: "rgba(13,26,19,0.7)", border: `1px solid ${T.border}`,
      borderRadius: 10, padding: "28px 26px",
    },
    progressRow: { display: "flex", gap: 6, marginBottom: 22 },
    progressDot: (active, done) => ({
      flex: 1, height: 3, borderRadius: 2,
      background: done || active ? T.green : "rgba(231,240,234,0.1)",
      opacity: active ? 1 : done ? 0.6 : 1,
      transition: "background 0.2s",
    }),
    stepLabel: {
      fontSize: 8.5, color: T.textFaint, letterSpacing: "2px",
      textTransform: "uppercase", fontFamily: T.mono, marginBottom: 10,
    },
    title: { fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", marginBottom: 6, lineHeight: 1.3 },
    sub: { fontSize: 11.5, color: T.textDim, marginBottom: 20, lineHeight: 1.6 },
    input: (hasError) => ({
      width: "100%", padding: "11px 14px", borderRadius: 6,
      background: "rgba(4,10,6,0.6)", color: T.text,
      border: `1px solid ${hasError ? T.red : T.borderMd}`,
      fontSize: 13, fontFamily: T.sans, outline: "none", boxSizing: "border-box",
    }),
    option: (selected, hov) => ({
      width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 6,
      background: selected ? "rgba(34,197,94,0.12)" : hov ? "rgba(34,197,94,0.05)" : "transparent",
      border: `1px solid ${selected ? T.green : T.border}`,
      color: selected ? T.pale : T.text,
      fontSize: 12.5, fontFamily: T.sans, cursor: "pointer", marginBottom: 8,
      transition: "all 0.15s",
    }),
    errorText: { fontSize: 10.5, color: T.red, marginTop: 8, fontFamily: T.mono },
    footerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 },
    backBtn: { background: "none", border: "none", color: T.textDim, fontSize: 11, cursor: "pointer", padding: "8px 4px" },
    nextBtn: {
      padding: "10px 22px", background: T.green, color: T.bg,
      border: "none", borderRadius: 6, fontSize: 11.5, fontWeight: 700,
      cursor: "pointer", letterSpacing: "0.3px", fontFamily: T.sans,
    },
    skipBtn: { background: "none", border: "none", color: T.textFaint, fontSize: 9.5, cursor: "pointer", fontFamily: T.mono, letterSpacing: "0.5px" },
    amountValue: {
      fontSize: 30, fontWeight: 800, color: T.mint, fontFamily: T.mono,
      textAlign: "center", marginBottom: 20, letterSpacing: "-0.5px",
    },
    slider: {
      width: "100%", accentColor: T.green, cursor: "pointer",
    },
    sliderLabels: {
      display: "flex", justifyContent: "space-between", marginTop: 6,
      fontSize: 9.5, color: T.textFaint, fontFamily: T.mono,
    },
  };

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={s.progressRow}>
          {STEPS.map((_, i) => (
            <div key={i} style={s.progressDot(i === step, i < step)} />
          ))}
        </div>

        <div style={s.stepLabel}>Step {step + 1} of {STEPS.length}</div>
        <div style={s.title}>{current.title}</div>
        <div style={s.sub}>{current.sub}</div>

        {current.type === "text" && (
          <input
            type={current.inputType || "text"}
            value={answers[current.id] || ""}
            placeholder={current.placeholder}
            onChange={(e) => setAnswer(e.target.value)}
            style={s.input(!!error)}
            onKeyDown={(e) => { if (e.key === "Enter") goNext(); }}
            autoFocus
          />
        )}

        {current.type === "select" && (
          <div>
            {current.options.map((opt, i) => (
              <button
                key={opt.label}
                type="button"
                style={s.option(answers[current.id] === i, hovOpt === i)}
                onMouseEnter={() => setHovOpt(i)}
                onMouseLeave={() => setHovOpt(null)}
                onClick={() => setAnswer(i)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {current.type === "amount" && (
          <div>
            <div style={s.amountValue}>
              ₹{(answers.amount ?? current.default).toLocaleString("en-IN")}
            </div>
            <input
              type="range"
              min={current.min}
              max={current.max}
              step={current.step}
              value={answers.amount ?? current.default}
              onChange={(e) => setAnswer(Number(e.target.value))}
              style={s.slider}
            />
            <div style={s.sliderLabels}>
              <span>₹15,000</span>
              <span>₹5,00,000</span>
            </div>
          </div>
        )}

        {error && <div style={s.errorText}>{error}</div>}

        <div style={s.footerRow}>
          <div>
            {step > 0 ? (
              <button style={s.backBtn} onClick={goBack}>← Back</button>
            ) : (
              <button style={s.skipBtn} onClick={skip}>SKIP FOR NOW</button>
            )}
          </div>
          <button style={s.nextBtn} onClick={goNext}>
            {isLast ? "See my signals →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}