migrate((app) => {
  // No-op. This migration previously introduced separate raw-markdown fields,
  // but the project now uses a single markdown field for each content block.
});
