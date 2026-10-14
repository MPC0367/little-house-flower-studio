import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window={addEventListener(){}};
globalThis.document={documentElement:{}};
globalThis.location={origin:'https://demo.example'};
globalThis.localStorage={getItem(){return null;},setItem(){}};

const {safeOrderImagePath}=await import('../public/studio/order-design.mjs');

test('Studio order images accept only exact same-origin image routes',()=>{
  const hosted='/api/preview-assets/hosted-composition-0123456789abcdef01234567';
  assert.equal(safeOrderImagePath('/img/flowers/white-rose.webp'),'/img/flowers/white-rose.webp');
  assert.equal(safeOrderImagePath('img/original-logo.jpg'),'/img/original-logo.jpg');
  assert.equal(safeOrderImagePath('/api/assets/550e8400-e29b-41d4-a716-446655440000'),'/api/assets/550e8400-e29b-41d4-a716-446655440000');
  assert.equal(safeOrderImagePath(hosted),hosted);
});

test('Studio order images reject external, traversal and near-match URLs',()=>{
  for(const source of [
    '//evil.example/img/flower.webp',
    'https://evil.example/img/flower.webp',
    '/img/../private.webp',
    '/img/%2e%2e/private.webp',
    '/img/flower.webp?download=1',
    '/api/preview-assets/hosted-composition-0123456789abcdef0123456',
    '/api/preview-assets/hosted-composition-0123456789abcdef012345678',
    '/api/preview-assets/hosted-composition-0123456789abcdef01234567.png',
    '/api/preview-assets/untrusted-0123456789abcdef01234567',
  ])assert.equal(safeOrderImagePath(source),null,source);
});
