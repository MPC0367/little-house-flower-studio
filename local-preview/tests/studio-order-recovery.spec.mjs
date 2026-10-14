import {test, expect} from '@playwright/test';

const admin = 'http://127.0.0.1:5274';

async function loginToOrders(page, role = 'read-only') {
  await page.goto(admin + '/#orders');
  await page.getByLabel('Demo role', {exact: true}).selectOption(role);
  await page.locator('.login button[type="submit"]').click();
  await expect(page.locator('.order-name button').first()).toBeVisible();
}

function observeFailuresAndWrites(page) {
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (/^\/api\/admin\/orders(?:\/|$)/.test(url.pathname) && !['GET', 'HEAD'].includes(request.method())) {
      writes.push(request.method() + ' ' + url.pathname);
    }
  });
  return {errors, writes};
}

async function visibleLanguageControls(page) {
  const group = page.locator('.studio-language').first();
  await expect(group.locator('[data-admin-language="en"]')).toBeVisible();
  await expect(group.locator('[data-admin-language="th"]')).toBeVisible();
}

test('expired staff session explains recovery and opens the requested order after explicit sign-in', async ({page, context}) => {
  const observed = observeFailuresAndWrites(page);
  await loginToOrders(page);
  await visibleLanguageControls(page);
  const orderButton = page.locator('.order-name button').first();
  const reference = await orderButton.locator('strong').innerText();
  await context.clearCookies();
  await orderButton.click();
  await expect(page.locator('.login')).toBeVisible();
  await expect(page.locator('.login')).toContainText('Your session has expired. Sign in again to open this order.');
  await expect(page.locator('dialog.drawer[open]')).toHaveCount(0);
  await visibleLanguageControls(page);
  await page.getByLabel('Demo role', {exact: true}).selectOption('read-only');
  await page.locator('.login button[type="submit"]').click();
  await expect(page.locator('dialog.drawer[open] h2').first()).toHaveText(reference.split(' · ')[0]);
  await expect(page.getByRole('button', {name:'Save changes', exact:true})).toBeDisabled();
  expect(observed.errors).toEqual([]);
  expect(observed.writes).toEqual([]);
});

for (const failure of ['server', 'network']) {
  test(`${failure} failure opening an order has a visible localized retry and preserves records`, async ({page}) => {
    const observed = observeFailuresAndWrites(page);
    await loginToOrders(page);
    if (failure === 'server') {
      await page.locator('[data-admin-language="th"]').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'th');
    }
    await visibleLanguageControls(page);
    const orderButton = page.locator('.order-name button').first();
    const reference = (await orderButton.locator('strong').innerText()).split(' · ')[0];
    const rowsBefore = await page.locator('.order-name button').count();
    let intercepted = 0;
    const routePattern = '**/api/admin/orders/*';
    await page.route(routePattern, async route => {
      if (route.request().method() !== 'GET') return route.continue();
      intercepted++;
      if (failure === 'network') return route.abort('failed');
      return route.fulfill({status:503, contentType:'application/json', body:JSON.stringify({error:'Connection unavailable'})});
    });
    await orderButton.click();
    const notice = page.locator('.order-open-error');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('role', 'alert');
    await expect(page.locator('dialog.drawer[open]')).toHaveCount(0);
    await expect(page.locator('.order-name button')).toHaveCount(rowsBefore);
    await visibleLanguageControls(page);
    expect(intercepted).toBe(1);
    if (failure === 'server') {
      await expect(notice).toContainText(/[ก-๙]/);
      await expect(notice).not.toContainText('Try again');
      await expect(notice).not.toContainText('Connection unavailable');
    } else {
      await expect(notice.getByRole('button', {name:'Try again', exact:true})).toBeVisible();
    }
    await page.unroute(routePattern);
    await notice.getByRole('button').first().click();
    await expect(page.locator('dialog.drawer[open] h2').first()).toHaveText(reference);
    await expect(page.locator('.order-open-error')).toHaveCount(0);
    await visibleLanguageControls(page);
    expect(observed.errors).toEqual([]);
    expect(observed.writes).toEqual([]);
  });
}


async function openOwnerOrder(page, reference) {
  await loginToOrders(page, 'owner');
  await page.getByLabel('Search orders', {exact:true}).fill(reference);
  await expect(page.locator('.order-name button')).toHaveCount(1);
  await page.locator('.order-name button').click();
  await expect(page.locator('dialog.drawer[open]')).toBeVisible();
}

// These write scenarios run only against Playwright's fresh, isolated QA database.
// The user review servers at 5173/5174 are never used by this file.
test('reauthentication after a saved order preserves later drafts and newer unrelated server fields', async ({page}) => {
  const observed = observeFailuresAndWrites(page);
  const id = 'demo-custom-basket', endpoint = admin + '/api/admin/orders/' + id;
  await openOwnerOrder(page, 'DEMO-CUSTOM-BASKET');
  const before = await (await page.request.get(endpoint)).json();
  const savedNote = 'Saved synthetic note before read recovery';
  const laterNote = 'New unsaved note entered while recovery notice was visible';
  const replyText = 'Unsent customer reply must survive reauthentication.';
  await page.getByLabel('Staff notes', {exact:true}).fill(savedNote);
  await page.getByLabel('Needs customer details', {exact:true}).check();
  await page.getByLabel('Amount (THB)', {exact:true}).fill('125');
  await page.getByLabel('Payment reference', {exact:true}).fill('UNRECORDED-RECOVERY-DRAFT');
  await page.getByLabel('Customer reply draft', {exact:true}).fill(replyText);
  let failNextRead = true;
  await page.route(endpoint, route => {
    if (route.request().method() !== 'GET' || !failNextRead) return route.continue();
    failNextRead = false;
    return route.fulfill({status:401, contentType:'application/json', body:JSON.stringify({error:'Staff sign-in required'})});
  });
  await page.getByRole('button', {name:'Save changes', exact:true}).click();
  const notice = page.locator('.order-open-error');
  await expect(notice).toBeVisible();
  const saved = await (await page.request.get(endpoint)).json();
  expect(saved.notes).toBe(savedNote);
  expect(saved.revision).toBe(before.revision + 1);
  expect(saved.needsDetails).toBe(true);
  expect(saved.payments).toEqual(before.payments);
  await page.getByLabel('Staff notes', {exact:true}).fill(laterNote);
  await page.getByLabel('Needs customer details', {exact:true}).uncheck();
  const concurrent = await page.request.patch(endpoint, {
    headers:{Origin:admin, 'X-CSRF':'local-preview'},
    data:{expectedRevision:saved.revision, deliveryFee:23500, reason:'Separate synthetic staff fee confirmation'},
  });
  expect(concurrent.ok()).toBe(true);
  const latest = await (await page.request.get(endpoint)).json();
  expect(latest.deliveryFee).toBe(23500);
  expect(latest.revision).toBe(saved.revision + 1);
  await notice.getByRole('button', {name:'Sign in again', exact:true}).click();
  await expect(page.locator('.session-recovery')).toBeVisible();
  await page.locator('.session-recovery form button[type="submit"]').click();
  await expect(page.locator('.session-recovery')).toHaveCount(0);
  await expect(notice).toHaveCount(0);
  await expect(page.locator('.drawer-head .eyebrow')).toContainText('REVISION ' + latest.revision);
  await expect(page.getByLabel('Staff notes', {exact:true})).toHaveValue(laterNote);
  await expect(page.getByLabel('Needs customer details', {exact:true})).not.toBeChecked();
  await expect(page.getByLabel('Delivery fee (THB, blank means unconfirmed)', {exact:true})).toHaveValue('235');
  await expect(page.getByLabel('Amount (THB)', {exact:true})).toHaveValue('125');
  await expect(page.getByLabel('Payment reference', {exact:true})).toHaveValue('UNRECORDED-RECOVERY-DRAFT');
  await expect(page.getByLabel('Customer reply draft', {exact:true})).toHaveValue(replyText);
  await expect(page.getByRole('button', {name:'Save changes', exact:true})).toBeEnabled();
  expect(await page.evaluate(() => window.LHFStudioHasUnsavedChanges())).toBe(true);
  // Saving only the restored edits must use the fresh revision and keep the fee.
  await page.getByRole('button', {name:'Save changes', exact:true}).click();
  await expect(page.locator('.drawer-head .eyebrow')).toContainText('REVISION ' + (latest.revision + 1));
  const final = await (await page.request.get(endpoint)).json();
  expect(final.notes).toBe(laterNote);
  expect(final.deliveryFee).toBe(23500);
  expect(final.needsDetails).toBe(false);
  expect(final.payments).toEqual(before.payments);
  expect(observed.writes.filter(write => write.includes('/payments'))).toEqual([]);
  expect(observed.errors).toEqual([]);
});

test('retry after a recorded payment clears that payment draft and keeps a reply edited during recovery', async ({page}) => {
  const observed = observeFailuresAndWrites(page);
  const id = 'demo-custom-bouquet', endpoint = admin + '/api/admin/orders/' + id;
  await openOwnerOrder(page, 'DEMO-CUSTOM-BOUQUET');
  const before = await (await page.request.get(endpoint)).json();
  await page.getByLabel('Amount (THB)', {exact:true}).fill('125');
  await page.getByLabel('Payment reference', {exact:true}).fill('RECOVERY-ONE-PAYMENT');
  await page.getByLabel('Customer reply draft', {exact:true}).fill('Reply before payment');
  let failNextRead = true;
  await page.route(endpoint, route => {
    if (route.request().method() !== 'GET' || !failNextRead) return route.continue();
    failNextRead = false;
    return route.fulfill({status:503, contentType:'application/json', body:JSON.stringify({error:'Connection unavailable'})});
  });
  await page.getByRole('button', {name:'Record payment', exact:true}).click();
  const notice = page.locator('.order-open-error');
  await expect(notice).toBeVisible();
  const paid = await (await page.request.get(endpoint)).json();
  expect(paid.payments).toHaveLength(before.payments.length + 1);
  expect(paid.payments.filter(payment => payment.externalReference === 'RECOVERY-ONE-PAYMENT')).toHaveLength(1);
  const revisedReply = 'Updated reply after the confirmed payment, while reconnecting.';
  await page.getByLabel('Customer reply draft', {exact:true}).fill(revisedReply);
  await notice.getByRole('button', {name:'Try again', exact:true}).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByLabel('Amount (THB)', {exact:true})).toHaveValue('');
  await expect(page.getByLabel('Payment reference', {exact:true})).toHaveValue('');
  await expect(page.getByLabel('Customer reply draft', {exact:true})).toHaveValue(revisedReply);
  await expect(page.getByRole('button', {name:'Record payment', exact:true})).toBeEnabled();
  const recovered = await (await page.request.get(endpoint)).json();
  expect(recovered.payments).toEqual(paid.payments);
  expect(observed.writes.filter(write => write === 'POST /api/admin/orders/' + id + '/payments')).toHaveLength(1);
  expect(observed.errors).toEqual([]);
});
