/** User-facing messages shared by the API, the pages, and the PDF, so each state reads the same everywhere. */
export const COPY = {
  locked: "The vendor's phone number changed recently, so Kovrell won't call it. Confirm the change with the vendor in person.",
  busy: "A call for this request is already running. Open it from the request page.",
  decided: "This request is already decided. Open its evidence pack to see the result.",
  requestNotFound: "No request with that ID.",
  runNotFound: "No verification run with that ID.",
  vendorNotFound: "No vendor with that ID.",
  sealing: "The evidence is still sealing. Try again in a minute.",
  runOpen: "This verification run hasn't finished yet.",
  held: "The payment stays on hold.",
} as const;
