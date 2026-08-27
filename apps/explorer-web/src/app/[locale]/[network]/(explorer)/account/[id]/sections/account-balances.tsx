"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HashDisplay } from "@/components/common/hash-display";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/utils";
import { Coins, Droplets, ChevronRight } from "lucide-react";
import type { Horizon } from "@stellar/stellar-sdk";
import { useTranslations } from "next-intl";

export function AccountBalances({ account }: { account: Horizon.ServerApi.AccountRecord }) {
  const t = useTranslations("account");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("balances")} ({account.balances.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {account.balances.map((balance) => {
            if (balance.asset_type === "liquidity_pool_shares") {
              const poolBalance = balance as Horizon.HorizonApi.BalanceLineLiquidityPool;
              return (
                <Link
                  key={`liquidity_pool_shares-${poolBalance.liquidity_pool_id}`}
                  href={`/liquidity-pool/${poolBalance.liquidity_pool_id}`}
                  className="group block"
                >
                  <div className="bg-card/50 hover:bg-muted/50 flex items-center justify-between rounded-lg p-3 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 flex size-8 items-center justify-center rounded-md">
                        <Droplets className="text-primary size-4" />
                      </div>
                      <div>
                        <span className="font-medium">{t("poolShares")}</span>
                        <div className="text-muted-foreground text-xs">
                          <HashDisplay
                            hash={poolBalance.liquidity_pool_id}
                            truncate
                            startLength={4}
                            endLength={4}
                            copyable={false}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums">
                        {formatNumber(poolBalance.balance)}
                      </span>
                      <ChevronRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              );
            }

            const isNative = balance.asset_type === "native";
            const assetCode = isNative
              ? "XLM"
              : (balance as Horizon.HorizonApi.BalanceLineAsset).asset_code;
            const issuer = isNative
              ? null
              : (balance as Horizon.HorizonApi.BalanceLineAsset).asset_issuer;

            return (
              <div
                key={`${balance.asset_type}-${assetCode}-${issuer || "native"}`}
                className="bg-card/50 flex items-center justify-between rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-chart-3/10 flex size-8 items-center justify-center rounded-md">
                    <Coins className="text-chart-3 size-4" />
                  </div>
                  <div>
                    <span className="font-medium">{assetCode}</span>
                    {issuer && (
                      <div className="text-muted-foreground text-xs">
                        <HashDisplay
                          hash={issuer}
                          truncate
                          startLength={4}
                          endLength={4}
                          copyable={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <span className="font-mono tabular-nums">{formatNumber(balance.balance)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
