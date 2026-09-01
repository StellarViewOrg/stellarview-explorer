import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { VerificationBadge } from "./verification-badge";
import en from "../../../../messages/en.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>
  );
}

afterEach(cleanup);

describe("VerificationBadge", () => {
  it("renders the verified label", () => {
    renderWithIntl(<VerificationBadge status="verified" />);
    expect(screen.getByText("Verified")).toBeTruthy();
  });

  it("renders the unverified label", () => {
    renderWithIntl(<VerificationBadge status="unverified" />);
    expect(screen.getByText("Unverified")).toBeTruthy();
  });

  it("renders the pending label", () => {
    renderWithIntl(<VerificationBadge status="pending" />);
    expect(screen.getByText("Pending")).toBeTruthy();
  });

  it("renders the not-available label", () => {
    renderWithIntl(<VerificationBadge status="not_available" />);
    expect(screen.getByText("Not Available")).toBeTruthy();
  });

  it("renders the mismatch label", () => {
    renderWithIntl(<VerificationBadge status="mismatch" />);
    expect(screen.getByText("Mismatch")).toBeTruthy();
  });

  it("renders the failed label", () => {
    renderWithIntl(<VerificationBadge status="failed" />);
    expect(screen.getByText("Failed")).toBeTruthy();
  });
});
