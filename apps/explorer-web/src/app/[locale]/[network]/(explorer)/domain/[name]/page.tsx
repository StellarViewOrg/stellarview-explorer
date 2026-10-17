import { DomainContent } from "./domain-content";

interface DomainPageProps {
  params: Promise<{ name: string }>;
}

// Render on first request, then serve the cached shell from the CDN. Data loads client-side,
// so the HTML only depends on the URL params.
export function generateStaticParams() {
  return [];
}

export default async function DomainPage({ params }: DomainPageProps) {
  const { name } = await params;
  return <DomainContent name={decodeURIComponent(name).toLowerCase()} />;
}
