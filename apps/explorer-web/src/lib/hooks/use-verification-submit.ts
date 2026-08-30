"use client";

import { useMutation } from "@tanstack/react-query";
import { submitVerification } from "@/lib/indexer";
import type { VerificationSubmissionRequest } from "@/lib/indexer";

/** Submits a contract source verification request to the indexer. */
export function useSubmitVerification() {
  return useMutation({
    mutationFn: (request: VerificationSubmissionRequest) => submitVerification(request),
  });
}
