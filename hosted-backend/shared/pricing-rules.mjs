// Owner-editable status register. No unverified adjustment is charged.
// Amounts are integer satang; enabling a numeric rule also requires its approval
// evidence, coverage and expiry to be implemented and tested in the price engine.
export const PRICING_RULES_VERSION='local-2026-10-14-v2';
export const pricingRules={
 sampleRulesEnabled:false,
 catalogue:{source:'preserved shop catalogue',expiryRequired:true,currency:'THB'},
 adjustments:[
  {id:'flower-selection',status:'needs-florist-costs',enabled:false,amountSatang:null},
  {id:'container-material',status:'needs-florist-costs',enabled:false,amountSatang:null},
  {id:'wrap-finish',status:'needs-florist-costs',enabled:false,amountSatang:null},
  {id:'ribbon',status:'needs-florist-costs',enabled:false,amountSatang:null},
  {id:'size',status:'needs-approved-size-exemplar',enabled:false,amountSatang:null},
  {id:'money-arranging-fee',status:'needs-florist-costs',enabled:false,amountSatang:null}
 ],
 delivery:{status:'distance-quote',amountSatang:null},
 banknotes:{role:'customer-requested-face-value',includedInArrangementPrice:false}
};
