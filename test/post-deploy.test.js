/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/* eslint-env mocha */
import assert from 'assert';
import { describe, it } from 'node:test';

const domain = process.env.CI
  ? 'helix-reviews-ci.helix-reviews.workers.dev'
  : 'helix-reviews-prod.aem.reviews';

describe('Helix Reviews Post-Deploy Validation', () => {
  it('Returns 404 for non-existent review', async function test() {
    if (!process.env.TEST_INTEGRATION) {
      this.skip();
    }

    const response = await fetch(`https://nonexistent--main--test--adobe.${domain}/`, {
      method: 'GET',
    });
    assert.strictEqual(response.status, 404);
    const text = await response.text();
    assert.strictEqual(text, 'Review Not Found');
  });

  it('robots.txt is served correctly', async function test() {
    if (!process.env.TEST_INTEGRATION) {
      this.skip();
    }

    // Use a valid review for testing
    const testDomain = `default--main--aem-boilerplate--adobe.${domain}`;
    const response = await fetch(`https://${testDomain}/robots.txt`, {
      method: 'GET',
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('content-type'), 'text/plain;charset=UTF-8');
    
    const text = await response.text();
    assert(text.includes('User-agent: *'), 'Should contain User-agent directive');
    assert(text.includes('Allow: /'), 'Should allow crawling');
    assert(text.includes(`Sitemap: https://${testDomain}/sitemap.xml`), 'Should include sitemap URL');
  });

  it('Manifest 404 returns proper error', async function test() {
    if (!process.env.TEST_INTEGRATION) {
      this.skip();
    }

    // Test with review ID that should not exist
    const response = await fetch(`https://review404--main--test--adobe.${domain}/`, {
      method: 'GET',
    });
    assert.strictEqual(response.status, 404);
  });

  it('Review with password protection returns 401 without auth', async function test() {
    if (!process.env.TEST_INTEGRATION) {
      this.skip();
    }

    // This test would need a known password-protected review
    // Skipping for now as we don't have a test review set up
    this.skip('Requires password-protected test review');
  });

  it('Snapshot redirect works correctly', async function test() {
    if (!process.env.TEST_INTEGRATION) {
      this.skip();
    }

    // Test snapshot redirect functionality
    const testDomain = `default--main--aem-boilerplate--adobe.${domain}`;
    const response = await fetch(`https://${testDomain}/.snapshots/test123/index.html`, {
      method: 'GET',
      redirect: 'manual',
    });
    
    // Should redirect (302)
    assert.strictEqual(response.status, 302);
    const location = response.headers.get('location');
    assert.strictEqual(location, '/index.html');
  });

  it('Response includes security headers', async function test() {
    if (!process.env.TEST_INTEGRATION) {
      this.skip();
    }

    const testDomain = `default--main--aem-boilerplate--adobe.${domain}`;
    const response = await fetch(`https://${testDomain}/robots.txt`, {
      method: 'GET',
    });
    
    // Check for x-robots-tag header on regular content
    const contentResponse = await fetch(`https://${testDomain}/`, {
      method: 'GET',
    });
    
    // If successful, should have noindex,nofollow
    if (contentResponse.status === 200) {
      assert.strictEqual(
        contentResponse.headers.get('x-robots-tag'),
        'noindex,nofollow',
        'Should prevent indexing of review content',
      );
    }
  });

  it('Service responds within reasonable time', async function test() {
    if (!process.env.TEST_INTEGRATION) {
      this.skip();
    }

    const startTime = Date.now();
    const testDomain = `default--main--aem-boilerplate--adobe.${domain}`;
    const response = await fetch(`https://${testDomain}/robots.txt`, {
      method: 'GET',
    });
    
    assert.strictEqual(response.status, 200);
    const duration = Date.now() - startTime;
    assert(duration < 5000, `Response took ${duration}ms, should be under 5000ms`);
  });
});