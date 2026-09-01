"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitVerification } from "@/lib/indexer";
import type { VerificationSubmissionRequest } from "@/lib/indexer";
import { useNetwork } from "@/lib/providers/network-provider";
import { stellarKeys } from "@/lib/stellar/queries";

/** Submits a contract source verification request to the indexer. */
export function useSubmitVerification(wasmHash: string) {
  const queryClient = useQueryClient();
  const { network } = useNetwork();
  return useMutation({
    mutationFn: (request: VerificationSubmissionRequest) => submitVerification(request),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: stellarKeys.contractVerification(network, wasmHash),
      });
    },
  });
}
