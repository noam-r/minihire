/**
 * Desktop inbox: one flat grid; each row uses `display: contents` so all cells share column tracks.
 */
export const applicationInboxTableClass =
  "hidden lg:grid lg:grid-cols-[minmax(0,1fr)_11rem_12rem_10.5rem_auto] lg:gap-x-4 lg:px-4 [&>:nth-last-child(-n+5)]:border-b-0";

export const applicationInboxHeaderCellClass =
  "border-b border-slate-200 bg-slate-50 py-3 text-xs font-medium uppercase tracking-wide text-slate-600";

export const applicationInboxDataCellClass = "border-b border-slate-100 py-3";

export const applicationInboxMobileCardClass =
  "space-y-3 border-b border-slate-100 px-4 py-3 last:border-0";
