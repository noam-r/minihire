import { parseValidationModelOutput } from "../shared/schemas";
import type { ValidationModelOutput } from "../shared/types";

export function parseValidationResult(raw: string): ValidationModelOutput {
  return parseValidationModelOutput(raw);
}
