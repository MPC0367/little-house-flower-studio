/* Local-only adapter. No production endpoint or notification fallback. */
LHF.localAPI=async function(path,body,options={}){const r=await fetch(path,{...options,method:options.method||(body?'POST':'GET'),headers:{'Content-Type':'application/json','X-CSRF':'local-preview',...(options.headers||{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok){const e=new Error(data.error||'Local service unavailable');e.status=r.status;throw e;}return data;};
LHF.localSession=LHF.localAPI('/api/session',{}).catch(()=>null);
LHF.sink=(function(){
  function summary(b) {
    const t = (k, p) => LHF.i18n.t(k, p), pick = (o) => LHF.i18n.pick(o), I = LHF.i18n, E = LHF.engine;
    const priceOf = (i) => (i.kind === 'quote' ? t('price.quote') : i.kind === 'from' ? t('price.from', { price: I.fmtPrice(i.line) }) : I.fmtPrice(i.line));
    const c = b.custom || null;
    const lines = ['Little House Flower · ' + t('done.ref') + ' ' + b.ref];
    (b.items || []).forEach((i) => lines.push('• ' + (i.qty > 1 ? i.qty + ' × ' : '') + (pick((LHF.catalog.byId(i.productId) || {}).name) || i.name) + ' — ' + priceOf(i)));
    if (c) {
      const p = c.fromProduct && LHF.catalog.byId(c.fromProduct);
      lines.push('• ' + t('custom.summary') + ': ' + [p ? pick(p.name) : '', t('custom.style.' + (c.style || 'bouquet')), c.occasion ? pick(LHF.catalog.occasion(c.occasion) || {}) : '', budgetLabel(c)].filter(Boolean).join(' · '));
      if (c.feel) lines.push('  ' + c.feel);
      if (c.notes) lines.push('  ' + c.notes);
    }
    if (b.colourNote) lines.push(t('book.sum.colour') + ': ' + b.colourNote);
    lines.push(t('book.step.when') + ': ' + I.fmtDate(b.date, 'weekday') + (b.windowLabel ? ' · ' + b.windowLabel : ''));
    const a = b.address;
    lines.push(t('book.step.how') + ': ' + (b.fulfil ? t('book.how.' + b.fulfil) : '') + (b.fulfil === 'delivery' && a ? ' — ' + [a.line, a.district, pick((LHF.data.delivery.provinces || []).find((p) => p.id === a.province) || {}), a.note].filter(Boolean).join(' ') : ''));
    if (b.customer && b.customer.name) lines.push(t('book.who.you') + ': ' + b.customer.name + ' · ' + E.fmtPhone(b.customer.phone) + (b.customer.line ? ' · LINE ' + b.customer.line : ''));
    if (b.fulfil === 'delivery' && b.recipient && b.recipient.name) lines.push(t('book.who.recipient') + ': ' + b.recipient.name + ' · ' + E.fmtPhone(b.recipient.phone || (b.customer || {}).phone) + (b.anonymous ? ' · ' + t('book.who.anon') : ''));
    if (b.card && b.card.message) lines.push(t('book.step.card') + ': ' + b.card.message);
    lines.push(t('book.review.total') + ': ' + totalLabel(b));
    if (c && (c.hasReference || c.reference)) lines.push(t('done.photo.line'));
    return lines.join('\n');
  }
  function budgetLabel(c) {
    const I = LHF.i18n;
    if (Number(c.budgetCustom) > 0) return I.fmtPrice(c.budgetCustom);
    const tiers = ((LHF.store.get('settings') || {}).budgetTiers) || LHF.data.bookingDefaults.budgetTiers;
    const tr = tiers.find((x) => x.id === c.budgetTier);
    return tr ? (tr.max ? I.fmtPrice(tr.min) + ' – ' + I.fmtPrice(tr.max) : I.fmtPrice(tr.min) + '+') : '';
  }
  /* the total as the customer may be told it: exact, "from", or confirmed on LINE */
  function totalLabel(b) {
    const t = (k, p) => LHF.i18n.t(k, p), I = LHF.i18n;
    const delivery = b.fulfil === 'delivery' ? ' + ' + t('book.review.delivery').toLowerCase() : '';
    if (b.hasQuote || (b.quoteOnly && !b.priceFrom)) return t('book.review.quoteNote');
    if (b.priceFrom) return t('book.review.fromTotal', { price: I.fmtPrice(b.subtotal) }) + delivery;
    return I.fmtPrice(b.subtotal) + delivery;
  }
  /* LINE's own "message this account" link, with the text already typed in */
  const lineUrl = (text) => 'https://line.me/R/oaMessage/' + encodeURIComponent(LHF.data.shop.lineId) + '/?' + encodeURIComponent(text || '');


function accept(booking,result){if(result.ok){if(result.receipt)Object.assign(booking,result.receipt);else for(const key of ['ref','windowId','windowLabel'])if(result[key]!=null)booking[key]=result[key];booking.revision=result.revision;booking.syncState=result.syncState;}return result;}
async function deliver(booking,opts={}){if(opts.hp)return {ok:false};await LHF.localSession;try{const recovered=await LHF.localAPI('/api/orders/submission/'+booking.id);if(recovered.ok)return accept(booking,recovered);}catch(e){if(e.status!==404)return {ok:false,reason:e.message};}try{return accept(booking,await LHF.localAPI('/api/orders', {...booking,consent:true},{signal:AbortSignal.timeout(12000)}));}catch(e){return {ok:false,reason:e.message};}}
return {deliver,summary,totalLabel,lineUrl,start(){},send(){},status:()=>({configured:true,blocked:false,queued:0})};
})();
LHF.pages.custom=async function(params,query){const {renderCustomizer}=await import('/customizer.mjs');return renderCustomizer(params,query);};
