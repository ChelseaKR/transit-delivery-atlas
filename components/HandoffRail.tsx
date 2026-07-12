const steps = [
  { className: "source", label: "Source", detail: "Signed language" },
  { className: "entity", label: "Entity", detail: "Explicitly named" },
  { className: "timing", label: "Timing", detail: "Stated or not stated" },
  { className: "analysis", label: "Analysis", detail: "Outputs and questions" },
];

export function HandoffRail() {
  return (
    <section className="handoff" aria-labelledby="handoff-title">
      <h2 id="handoff-title" className="visually-hidden">
        How to read the atlas
      </h2>
      <ol className="handoff__rail">
        {steps.map((step) => (
          <li key={step.label} className={`handoff__step handoff__step--${step.className}`}>
            <span className="handoff__node" aria-hidden="true" />
            <span className="handoff__copy">
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
