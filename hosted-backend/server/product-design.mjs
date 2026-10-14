// Store the published design alongside a new order so later catalogue edits
// cannot silently rewrite its flowers, colours, wrapping or physical size.
export function productDesignSnapshot(product){
 const snapshot={version:1,productId:product.id};
 for(const key of ['name','flowers','colors','wrap','size'])if(product[key]!=null)snapshot[key]=structuredClone(product[key]);
 return snapshot;
}
