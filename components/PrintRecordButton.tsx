"use client";

/**
 * A print affordance for a directive record page. The page's `@media print`
 * rules already strip the site chrome, filters, and pagination and force a
 * high-contrast black-on-white layout, so triggering the browser's own print
 * dialog yields a clean, self-contained brief of the directive, its source
 * excerpt, evidence, and analysis. The button itself is hidden when printing.
 */
export function PrintRecordButton() {
  return (
    <button type="button" className="print-record-button" onClick={() => window.print()}>
      Print this record
    </button>
  );
}
