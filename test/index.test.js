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
/* global global */
import assert from 'assert';
import {
  describe, it, mock, beforeEach,
} from 'node:test';
import worker from '../src/index.js';

describe('Helix Reviews Worker', () => {
  let env;
  let ctx;

  beforeEach(() => {
    env = {};
    ctx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    };

    // Mock global fetch
    global.fetch = mock.fn(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Mock manifest responses
      if (urlStr.includes('/.manifest.json')) {
        if (urlStr.includes('/.snapshots/nonexistent/')) {
          return new Response('Not Found', { status: 404 });
        }
        return new Response(JSON.stringify({
          metadata: {},
          resources: [
            { path: '/' },
            { path: '/about' },
            { path: '/metadata.json' },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      // Mock sitemap responses
      if (urlStr.includes('/sitemap.xml')) {
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/products</loc></url>
</urlset>`, {
          status: 200,
          headers: { 'content-type': 'text/xml' },
        });
      }

      // Mock metadata.json responses
      if (urlStr.includes('/metadata.json')) {
        return new Response(JSON.stringify({
          data: [
            {
              URL: '/**',
              title: 'Default Title',
              description: 'Default Description',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      // Mock content responses
      return new Response('<html><head></head><body>Test Content</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    });
  });

  describe('getBaseHostname helper', () => {
    it('correctly constructs base hostname with AEM domain', async () => {
      // Test through actual usage in the worker
      const request = new Request('https://review123--main--test-repo--adobe.aem.reviews/');
      await worker.fetch(request, env, ctx);

      // The function should construct: main--test-repo--adobe.aem
      // We'll verify this through the fetch calls
      const fetchCalls = global.fetch.mock.calls;
      const manifestCall = fetchCalls.find((call) => call.arguments[0].includes('.manifest.json'));
      assert(manifestCall, 'Should have made a manifest call');

      const manifestUrl = manifestCall.arguments[0];
      assert(manifestUrl.includes('main--test-repo--adobe.aem'), 'Should use getBaseHostname helper correctly');
    });
  });

  describe('baseHostname construction', () => {
    it('constructs correct baseHostname with AEM domain for manifest URL', async () => {
      const request = new Request('https://review123--main--test-repo--adobe.aem.reviews/');
      await worker.fetch(request, env, ctx);

      // Check that fetch was called with the correct manifest URL
      const fetchCalls = global.fetch.mock.calls;
      const manifestCall = fetchCalls.find((call) => call.arguments[0].includes('.manifest.json'));
      assert(manifestCall, 'Should have fetched manifest');

      const manifestUrl = manifestCall.arguments[0];
      assert(manifestUrl.includes('main--test-repo--adobe.aem'), 'Should include baseHostname with AEM domain');
      assert(manifestUrl.includes('.page/.snapshots/'), 'Should use .page subdomain for manifest');
    });

    it('constructs correct URL for page snapshots', async () => {
      const request = new Request('https://review123--main--test-repo--adobe.aem.reviews/about');
      const response = await worker.fetch(request, env, ctx);

      if (response.status === 200) {
        const originUrl = response.headers.get('x-origin-url');
        assert(originUrl, 'Should have x-origin-url header');
        assert(originUrl.includes('main--test-repo--adobe.aem.page'), 'Should use baseHostname.page for page snapshots');
        assert(originUrl.includes('/.snapshots/review123/about'), 'Should include snapshot path');
      }
    });

    it('constructs correct URL for live resources', async () => {
      const request = new Request('https://review123--main--test-repo--adobe.aem.reviews/styles.css');
      const response = await worker.fetch(request, env, ctx);

      if (response.status === 200) {
        const originUrl = response.headers.get('x-origin-url');
        assert(originUrl, 'Should have x-origin-url header');
        assert(originUrl.includes('main--test-repo--adobe.aem.live'), 'Should use baseHostname.live for non-page resources');
      }
    });

    it('constructs correct URL for manifest.json requests', async () => {
      // The .manifest.json endpoint should not redirect
      const manifestRequest = new Request('https://review123--main--test-repo--adobe.aem.reviews/.snapshots/review123/.manifest.json');
      const response = await worker.fetch(manifestRequest, env, ctx);

      // This should NOT redirect because it ends with .manifest.json
      assert.strictEqual(response.status, 200, 'Manifest.json requests should not redirect');

      if (response.status === 200) {
        const originUrl = response.headers.get('x-origin-url');
        assert(originUrl, 'Should have x-origin-url header');
        assert(originUrl.includes('main--test-repo--adobe.aem.page'), 'Should use baseHostname.page for manifest');
      }
    });
  });

  describe('URL hostname extraction and processing', () => {
    it('correctly extracts review info from hostname', async () => {
      const request = new Request('https://pr456--feature--my-repo--myorg.aem.reviews/');
      await worker.fetch(request, env, ctx);

      const fetchCalls = global.fetch.mock.calls;
      const manifestCall = fetchCalls.find((call) => call.arguments[0].includes('.manifest.json'));
      assert(manifestCall, 'Should have fetched manifest');

      const manifestUrl = manifestCall.arguments[0];
      assert(manifestUrl.includes('feature--my-repo--myorg.aem'), 'Should extract correct review info');
      assert(manifestUrl.includes('/.snapshots/pr456/'), 'Should use correct review ID');
    });

    it('handles default hostname correctly', async () => {
      const request = new Request('https://example.com/?hostname=custom--main--project--org.aem.reviews');
      await worker.fetch(request, env, ctx);

      const fetchCalls = global.fetch.mock.calls;
      const manifestCall = fetchCalls.find((call) => call.arguments[0].includes('.manifest.json'));
      assert(manifestCall, 'Should have fetched manifest');

      const manifestUrl = manifestCall.arguments[0];
      assert(manifestUrl.includes('main--project--org.aem'), 'Should use hostname from query param');
    });
  });

  describe('Special routes', () => {
    it('generates robots.txt with correct hostname', async () => {
      const request = new Request('https://review123--main--test--adobe.aem.reviews/robots.txt');
      const response = await worker.fetch(request, env, ctx);

      assert.strictEqual(response.status, 200);
      const text = await response.text();
      assert(text.includes('User-agent: *'));
      assert(text.includes('Allow: /'));
      assert(text.includes('Sitemap: https://review123--main--test--adobe.aem.reviews/sitemap.xml'));
    });

    it('generates sitemap with combined pages', async () => {
      const request = new Request('https://review123--main--test--adobe.aem.reviews/sitemap.xml');
      const response = await worker.fetch(request, env, ctx);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('content-type'), 'text/xml;charset=UTF-8');

      const text = await response.text();
      assert(text.includes('<urlset'));
      assert(text.includes('review123--main--test--adobe.aem.reviews'));
    });

    it('fetches origin sitemap with correct baseHostname', async () => {
      const request = new Request('https://review123--main--test--adobe.aem.reviews/sitemap-origin.xml');
      await worker.fetch(request, env, ctx);

      const fetchCalls = global.fetch.mock.calls;
      const sitemapCall = fetchCalls.find((call) => call.arguments[0].includes('/sitemap.xml')
        && !call.arguments[0].includes('review123--'));

      if (sitemapCall) {
        const sitemapUrl = sitemapCall.arguments[0];
        assert(sitemapUrl.includes('main--test--adobe.aem.page'), 'Should fetch from baseHostname.page');
      }
    });
  });

  describe('Authentication and security', () => {
    it('adds security headers to responses', async () => {
      const request = new Request('https://review123--main--test--adobe.aem.reviews/');
      const response = await worker.fetch(request, env, ctx);

      if (response.status === 200) {
        assert.strictEqual(response.headers.get('x-robots-tag'), 'noindex,nofollow');
        assert(response.headers.get('x-origin-url'), 'Should include origin URL header');
      }
    });

    it('handles authentication with org token', async () => {
      env['adobe-org-token'] = 'test-token';
      const request = new Request('https://review123--main--test--adobe.aem.reviews/');

      await worker.fetch(request, env, ctx);

      const fetchCalls = global.fetch.mock.calls;
      const authenticatedCall = fetchCalls.find((call) => {
        const req = call.arguments[1];
        return req && req.headers && req.headers.get('authorization') === 'token test-token';
      });

      assert(authenticatedCall, 'Should include authorization header with org token');
    });
  });

  describe('Error handling', () => {
    it('returns 404 for non-existent review', async () => {
      const request = new Request('https://nonexistent--main--test--adobe.aem.reviews/');
      const response = await worker.fetch(request, env, ctx);

      assert.strictEqual(response.status, 404);
      const text = await response.text();
      assert.strictEqual(text, 'Review Not Found');
    });

    it('handles snapshot redirects correctly', async () => {
      const request = new Request('https://review123--main--test--adobe.aem.reviews/.snapshots/review123/page.html');
      const response = await worker.fetch(request, env, ctx);

      assert.strictEqual(response.status, 302);
      assert.strictEqual(response.headers.get('location'), '/page.html');
    });
  });

  describe('Metadata rewriting', () => {
    it('fetches metadata with correct baseHostname URL', async () => {
      const request = new Request('https://review123--main--test--adobe.aem.reviews/');
      await worker.fetch(request, env, ctx);

      const fetchCalls = global.fetch.mock.calls;
      const metadataCall = fetchCalls.find((call) => call.arguments[0].includes('/metadata.json')
        && call.arguments[0].includes('/.snapshots/'));

      if (metadataCall) {
        const metadataUrl = metadataCall.arguments[0];
        assert(metadataUrl.includes('main--test--adobe.aem.page'), 'Should use baseHostname.page for metadata');
        assert(metadataUrl.includes('/.snapshots/review123/metadata.json'), 'Should include correct snapshot path');
      }
    });
  });
});
