// @flow

import {Ledger} from "../ledger";
import {type Distribution} from "../distribution";
import * as G from "../grain";
import sortBy from "../../../util/sortBy";
import {type IdentityId} from "../../identity";
import * as NullUtil from "../../../util/null";
import {type CurrencyDetails} from "../../../api/currencyConfig";

export function distributionMarkdownSummary(
  distribution: Distribution,
  ledger: Ledger,
  currencyDetails: CurrencyDetails
) {
  const {name: currencyName, suffix: currencySuffix} = currencyDetails;
  const distributionBalances: DistributionBalances = getDistributionBalances(
    distribution
  );
  const totalDistributed: G.Grain = getTotalDistributed(distributionBalances);

  const ids = Array.from(distributionBalances.keys());
  const countIdentities = ids.length;

  console.log(`## ${currencyName.toUpperCase()} Distribution`);
  console.log(
    `#### Distributed ${G.format(
      totalDistributed,
      0,
      currencySuffix
    )} to ${countIdentities} identities`
  );

  distribution.allocations.forEach(({policy}) => {
    const {policyType, budget} = policy;
    console.log(`#### ${policyType}: ${G.format(budget, 0, currencySuffix)}`);
  });
  console.log();

  // Get the relevant column strings, omitting columns for unused policies.
  const policyHeaders = `|          name          |    total    |     %     |`;
  const divider = `| ---------------------- | ----------- | --------- |`;
  console.log(policyHeaders);
  console.log(divider);

  // Sort the accounts by total allocated before printing them in that order.
  const sortedIds: $ReadOnlyArray<IdentityId> = sortBy(
    ids,
    (id) => -Number(distributionBalances.get(id))
  );

  // Print rows in sorted order.
  sortedIds.map((id) => console.log(row(id)));
  console.log();

  function row(id: IdentityId) {
    const {name} = ledger.account(id).identity;
    const nameFormatted = formatCenter(name, 22);

    const total = NullUtil.orElse(distributionBalances.get(id), G.ZERO);
    const totalFormatted = formatCenter(G.format(total, 3, ""), 11);

    const percentage = 100 * G.toFloatRatio(total, totalDistributed);
    const percentageFormatted = formatCenter(percentage.toFixed(2) + "%", 9);

    return `| ${nameFormatted} | ${totalFormatted} | ${percentageFormatted} |`;
  }
}

/**
 * Center string in some whitespace for total length {len}.
 */
export function formatCenter(str: string, len: number): string {
  return str.length >= len
    ? str
    : str.length < len - 1
    ? formatCenter(` ${str} `, len)
    : formatCenter(`${str} `, len);
}

/**
 * Given some distribution, return the total allocated to id across
 * all allocation policies.
 */
export type DistributionBalances = Map<IdentityId, G.Grain>;
export function getDistributionBalances(
  distribution: Distribution
): DistributionBalances {
  const distributionBalances = new Map<IdentityId, G.Grain>();

  distribution.allocations.map(({receipts}) => {
    receipts.map(({amount, id}) => {
      const existing = NullUtil.orElse(distributionBalances.get(id), G.ZERO);
      distributionBalances.set(id, G.add(amount, existing));
    });
  });

  return distributionBalances;
}

/**
 * Given DistributionBalances, return total grain distributed
 * across participants.
 */
export function getTotalDistributed(
  distributionBalances: DistributionBalances
): G.Grain {
  let total: G.Grain = G.ZERO;
  distributionBalances.forEach((amount) => {
    total = G.add(total, amount);
  });
  return total;
}
