// Who a batch of QR-pass emails goes to.
//   team       = flagged is_team (BOD / volunteers / speakers etc.)
//   registered = everyone else with a paid ticket
//   all        = both
export type SendScope = "team" | "registered" | "all";

export const isScope = (v: unknown): v is SendScope =>
  v === "team" || v === "registered" || v === "all";
