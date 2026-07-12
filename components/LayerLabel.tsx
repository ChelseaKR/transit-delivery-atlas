export function LayerLabel({ type }: { type: "source" | "analysis" }) {
  return (
    <p className={`layer-label layer-label--${type}`}>
      <span aria-hidden="true" />
      {type === "source" ? "Source record" : "Independent analysis"}
    </p>
  );
}
