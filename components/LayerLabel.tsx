const labels = {
  source: "Source record",
  evidence: "Reviewed public evidence",
  analysis: "Independent analysis",
} as const;

export function LayerLabel({
  type,
}: {
  type: keyof typeof labels;
}) {
  return (
    <p className={`layer-label layer-label--${type}`}>
      <span aria-hidden="true" />
      {labels[type]}
    </p>
  );
}
