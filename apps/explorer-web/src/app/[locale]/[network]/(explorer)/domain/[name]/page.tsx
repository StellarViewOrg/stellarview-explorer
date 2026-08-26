import { DomainContent } from "./domain-content";

interface DomainPageProps {
  params: Promise<{ name: string }>;
}

export default async function DomainPage({ params }: DomainPageProps) {
  const { name } = await params;
  return <DomainContent name={decodeURIComponent(name).toLowerCase()} />;
}
