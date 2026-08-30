import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { DiffView } from "./diff-view";
import en from "../../../../messages/en.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>
  );
}

afterEach(cleanup);

describe("DiffView", () => {
  it("shows the no-changes message for identical content", () => {
    renderWithIntl(
      <DiffView path="src/lib.rs" before="pub fn main() {}" after="pub fn main() {}" />
    );
    expect(screen.getByText("No differences between these versions")).toBeTruthy();
  });

  it("renders added and removed lines when content differs", () => {
    renderWithIntl(<DiffView path="src/lib.rs" before="fn old() {}" after="fn new() {}" />);
    expect(screen.getByText(/fn old\(\)/)).toBeTruthy();
    expect(screen.getByText(/fn new\(\)/)).toBeTruthy();
  });

  it("renders the file path header", () => {
    renderWithIntl(<DiffView path="src/lib.rs" before="a" after="b" />);
    expect(screen.getByText("src/lib.rs")).toBeTruthy();
  });
});
