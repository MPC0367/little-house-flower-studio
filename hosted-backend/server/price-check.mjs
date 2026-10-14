import {legacy,estimate,hash} from './domain.mjs';
export function priceCheck(booking){
 const s=legacy.engine.priceSummary(booking);
 const result={currency:'THB',subtotal:s.subtotal,hasQuote:s.hasQuote,priceFrom:s.priceFrom,quoteOnly:s.quoteOnly,
  items:s.items.map(i=>({productId:i.product.id,qty:i.qty,unit:i.unit,line:i.line,kind:i.kind})),
  estimate:booking.custom?.config?estimate(booking.custom.config):null};
 return {...result,signature:hash(result),checkedAt:new Date().toISOString()};
}
