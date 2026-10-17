import { Metadata } from "next";
import { PairContent } from "./pair-content";
import { parsePairSlug } from "@/lib/utils";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parsePairSlug(slug);

  if (!parsed) {
    return { title: "Pair Not Found" };
  }

  const { base, counter } = parsed;
  const pairLabel = `${base.code}/${counter.code}`;

  return {
    title: `${pairLabel} | StellarView Explorer`,
    description: `View the ${pairLabel} trading pair on Stellar: candlestick chart, recent trades, and order book.`,
    openGraph: {
      title: `${pairLabel} — Stellar Trading Pair`,
      description: `Candlestick chart, recent trades, and order book for ${pairLabel} on Stellar.`,
      type: "website",
    },
  };
}

export default async function PairPage({ params }: Props) {
  const { slug } = await params;
  return <PairContent slug={slug} />;
}
