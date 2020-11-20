// @flow

import * as P from "../../../util/combo";
import {
  type BalancedPolicy,
  type Balanced,
  balancedReceipts,
  balancedPolicyParser,
} from "./balanced";
import {
  type ImmediatePolicy,
  type Immediate,
  immediateReceipts,
  immediatePolicyParser,
} from "./immediate";
import {
  type RecentPolicy,
  type Recent,
  recentReceipts,
  recentPolicyParser,
} from "./recent";
import {
  type SpecialPolicy,
  type Special,
  specialReceipts,
  specialPolicyParser,
} from "./special";

export {balancedReceipts, balancedPolicyParser};
export {immediateReceipts, immediatePolicyParser};
export {recentReceipts, recentPolicyParser};
export {specialReceipts, specialPolicyParser};

export type AllocationPolicy =
  | BalancedPolicy
  | ImmediatePolicy
  | RecentPolicy
  | SpecialPolicy;

export type AllocationPolicyType = Balanced | Immediate | Recent | Special;

export const allocationPolicyParser: P.Parser<AllocationPolicy> = P.orElse([
  balancedPolicyParser,
  immediatePolicyParser,
  recentPolicyParser,
  specialPolicyParser,
]);
