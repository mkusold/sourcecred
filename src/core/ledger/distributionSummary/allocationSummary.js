// @flow

import {Ledger} from "../ledger";
import {type Distribution} from "../distribution";
import {type Allocation} from "../grainAllocation";
import {type GrainReceipt} from "../grainAllocation";
import * as G from "../grain";
import sortBy from "../../../util/sortBy";
import {type IdentityId} from "../../identity";
import * as NullUtil from "../../../util/null";
import {type CurrencyDetails} from "../../../api/currencyConfig";
import {formatCenter} from "./distributionSummary";

export function allocationMarkdownSummary(
  distribution: Distribution,
  allocation: Allocation,
  ledger: Ledger,
  currencyDetails: CurrencyDetails
) {
  const {suffix: currencySuffix} = currencyDetails;
  const {receipts} = allocation;
  const totalDistributed: G.Grain = getTotalDistributed(receipts);
  console.log(`## ${allocation.policy.policyType} Policy`);

  console.log(
    `### Distributed ${G.format(totalDistributed, 0, currencySuffix)} to ${
      receipts.length
    } identities`
  );

  // Get the relevant column strings, omitting columns for unused policies.
  const policyHeaders = `|          name          |    total    |     %     |`;
  const divider = `| ---------------------- | ----------- | --------- |`;

  console.log();
  console.log(policyHeaders);
  console.log(divider);

  // Sort the accounts by total allocated before printing them in that order.
  const sortedReceipts: $ReadOnlyArray<GrainReceipt> = sortBy(
    receipts,
    (receipt) => -Number(receipt.amount)
  );
  sortedReceipts.map(({id, amount}) => console.log(row(id, amount)));
  console.log();

  function row(id: IdentityId, amount: G.Grain) {
    const {name} = ledger.account(id).identity;
    const nameFormatted = formatCenter(name, 22);

    const total = NullUtil.orElse(amount, G.ZERO);
    const totalFormatted = formatCenter(G.format(total, 3, ""), 11);

    const percentage = 100 * G.toFloatRatio(total, totalDistributed);
    const percentageFormatted = formatCenter(percentage.toFixed(2) + "%", 9);

    return `| ${nameFormatted} | ${totalFormatted} | ${percentageFormatted} |`;
  }
}

/**
 * Given {allocationBalances}, return the total Grain distributed across ids.
 */
export function getTotalDistributed(
  receipts: $ReadOnlyArray<GrainReceipt>
): G.Grain {
  return receipts.reduce((sum, {amount}) => G.add(sum, amount), G.ZERO);
}
