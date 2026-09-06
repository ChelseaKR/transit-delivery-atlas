import { evidenceVerificationFor } from "@/lib/data";
import { formatDate } from "@/lib/format";

/**
 * "Artifact last re-checked": whether a cited artifact still hashes to the bytes
 * this register reviewed.
 *
 * One component, every surface that renders an evidence card. The link-integrity
 * check arrived on `/evidence` alone, and the directive page --- which renders the
 * same records, from the same log, in the same `evidence-meta` list --- never
 * learned it. With one record's artifact marked `changed`, `/evidence` published
 * the hash mismatch while `/directives/n-7-26-5` rendered the identical card with
 * no integrity line at all and still offered "Open public record" beside it. Same
 * record, same build, two different stories about whether the citation still
 * resolves.
 *
 * Sharing the row is the point rather than copying it: this defect is what a
 * second copy of these nine lines already looked like, and a third surface that
 * cites an artifact gets the disclosure by construction instead of by whoever
 * remembers.
 *
 * A record the log does not cover renders nothing at all. "Never re-checked" is
 * not a check that passed, and the one thing this row must never do is imply that
 * an unverified artifact was verified --- so the absent case stays absent rather
 * than borrowing the log's own date, exactly as `lib/data.ts` sets out.
 */
export function ArtifactIntegrityRow({ recordId }: { recordId: string }) {
  const verified = evidenceVerificationFor(recordId);
  if (!verified) return null;
  return (
    <div>
      <dt>Artifact last re-checked</dt>
      <dd>
        <time dateTime={verified.checkedOn}>{formatDate(verified.checkedOn)}</time>
        <span>
          {verified.artifact.outcome === "intact"
            ? "The published file still hashes to the bytes reviewed for this record."
            : verified.artifact.detail}
        </span>
      </dd>
    </div>
  );
}
