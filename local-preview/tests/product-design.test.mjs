import test from 'node:test';import assert from 'node:assert/strict';
import {productDesignSnapshot} from '../server/product-design.mjs';
test('saved product design uses published fields and survives future catalogue edits',()=>{
 const product={id:'white-rose',name:{en:'White Rose',th:'กุหลาบขาว'},flowers:['rose_white'],colors:['white'],wrap:{en:'White layered foam with cream ribbon'},size:{w:60,h:60},price:1090,notes:'Not part of a published design'};
 const snapshot=productDesignSnapshot(product);product.flowers.push('sunflower');product.wrap.en='New wrap';product.size.w=80;
 assert.deepEqual(snapshot.flowers,['rose_white']);assert.equal(snapshot.wrap.en,'White layered foam with cream ribbon');assert.equal(snapshot.size.w,60);assert.equal(snapshot.notes,undefined);assert.equal(snapshot.price,undefined);
});
test('unknown design characteristics remain unspecified instead of being invented',()=>{
 const snapshot=productDesignSnapshot({id:'seasonal',name:{en:'Seasonal design'}});
 assert.equal(snapshot.wrap,undefined);assert.equal(snapshot.colors,undefined);assert.equal(snapshot.size,undefined);
});
