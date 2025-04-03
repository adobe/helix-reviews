import { handleRequest } from './index';

// Mock the fetch API
global.fetch = jest.fn();

// Mock crypto.subtle
global.crypto = {
    subtle: {
        digest: jest.fn()
    }
};

// Mock TextEncoder
global.TextEncoder = jest.fn().mockImplementation(() => ({
    encode: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3]))
}));

describe('AEM Review Worker', () => {
    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        
        // Default mock for crypto.subtle.digest
        global.crypto.subtle.digest.mockResolvedValue(new Uint8Array([1, 2, 3]));
    });

    describe('Snapshot Redirects', () => {
        it('should redirect snapshot URLs', async () => {
            const request = new Request('https://example.com/.snapshots/123/path/to/page');
            const response = await handleRequest(request);
            
            expect(response.status).toBe(302);
            expect(response.headers.get('location')).toBe('/path/to/page');
        });

        it('should not redirect manifest.json', async () => {
            const request = new Request('https://example.com/.snapshots/123/.manifest.json');
            const response = await handleRequest(request);
            
            expect(response.status).not.toBe(302);
        });
    });

    describe('Hostname Parsing', () => {
        it('should use reviews domain when available', async () => {
            const request = new Request('https://test--main--repo--owner.hlx.reviews/path');
            const response = await handleRequest(request);
            
            expect(response.status).toBe(404); // 404 because manifest fetch fails
        });

        it('should use hostname from query params when not a reviews domain', async () => {
            const request = new Request('https://example.com/path?hostname=test--main--repo--owner.aem.reviews');
            const response = await handleRequest(request);
            
            expect(response.status).toBe(404);
        });

        it('should use default hostname when no hostname provided', async () => {
            const request = new Request('https://example.com/path');
            const response = await handleRequest(request);
            
            expect(response.status).toBe(404);
        });
    });

    describe('Special Routes', () => {
        it('should generate robots.txt', async () => {
            const request = new Request('https://example.com/robots.txt');
            const response = await handleRequest(request);
            
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
            expect(await response.text()).toContain('Sitemap:');
        });

        it('should generate sitemap.xml', async () => {
            const request = new Request('https://example.com/sitemap.xml');
            const manifestResponse = new Response(JSON.stringify({
                resources: [{ path: '/page1' }, { path: '/page2' }]
            }));
            
            global.fetch.mockResolvedValueOnce(manifestResponse);
            global.fetch.mockResolvedValueOnce(new Response('<urlset><url><loc>https://example.com/page1</loc></url></urlset>'));
            
            const response = await handleRequest(request);
            
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('text/xml;charset=UTF-8');
            expect(await response.text()).toContain('<urlset');
        });
    });

    describe('Authentication', () => {
        it('should allow access when no password is set', async () => {
            const request = new Request('https://example.com/path');
            const manifestResponse = new Response(JSON.stringify({
                metadata: {},
                resources: [{ path: '/path' }]
            }));
            
            global.fetch.mockResolvedValueOnce(manifestResponse);
            global.fetch.mockResolvedValueOnce(new Response('content'));
            
            const response = await handleRequest(request);
            
            expect(response.status).toBe(200);
        });

        it('should require authentication when password is set', async () => {
            const request = new Request('https://example.com/path');
            const manifestResponse = new Response(JSON.stringify({
                metadata: { reviewPassword: 'test123' },
                resources: [{ path: '/path' }]
            }));
            
            global.fetch.mockResolvedValueOnce(manifestResponse);
            
            const response = await handleRequest(request);
            
            expect(response.status).toBe(401);
        });

        it('should allow access with correct password', async () => {
            const request = new Request('https://example.com/path', {
                headers: {
                    cookie: 'reviewPassword=010203'
                }
            });
            
            const manifestResponse = new Response(JSON.stringify({
                metadata: { reviewPassword: 'test123' },
                resources: [{ path: '/path' }]
            }));
            
            global.fetch.mockResolvedValueOnce(manifestResponse);
            global.fetch.mockResolvedValueOnce(new Response('content'));
            
            const response = await handleRequest(request);
            
            expect(response.status).toBe(200);
        });
    });

    describe('Content Delivery', () => {
        it('should handle plain.html requests', async () => {
            const request = new Request('https://example.com/page.plain.html');
            const manifestResponse = new Response(JSON.stringify({
                resources: [{ path: '/page' }]
            }));
            
            global.fetch.mockResolvedValueOnce(manifestResponse);
            global.fetch.mockResolvedValueOnce(new Response('content'));
            
            const response = await handleRequest(request);
            
            expect(response.status).toBe(200);
        });

        it('should handle snapshot pages', async () => {
            const request = new Request('https://example.com/page');
            const manifestResponse = new Response(JSON.stringify({
                resources: [{ path: '/page' }]
            }));
            
            global.fetch.mockResolvedValueOnce(manifestResponse);
            global.fetch.mockResolvedValueOnce(new Response('content'));
            
            const response = await handleRequest(request);
            
            expect(response.status).toBe(200);
        });

        it('should handle live pages', async () => {
            const request = new Request('https://example.com/page');
            const manifestResponse = new Response(JSON.stringify({
                resources: [{ path: '/other' }]
            }));
            
            global.fetch.mockResolvedValueOnce(manifestResponse);
            global.fetch.mockResolvedValueOnce(new Response('content'));
            
            const response = await handleRequest(request);
            
            expect(response.status).toBe(200);
        });
    });

    describe('Meta Tag Rewriting', () => {
        it('should rewrite meta tags based on rules', async () => {
            const request = new Request('https://example.com/page');
            const manifestResponse = new Response(JSON.stringify({
                resources: [{ path: '/metadata.json' }, { path: '/page' }]
            }));
            
            const metadataResponse = new Response(JSON.stringify({
                data: [{
                    URL: '/page',
                    title: 'Test Title',
                    description: 'Test Description'
                }]
            }));
            
            const contentResponse = new Response(`
                <html>
                    <head>
                        <meta name="title" content="Original Title">
                        <meta name="description" content="Original Description">
                    </head>
                    <body>Content</body>
                </html>
            `);
            
            global.fetch.mockResolvedValueOnce(manifestResponse);
            global.fetch.mockResolvedValueOnce(metadataResponse);
            global.fetch.mockResolvedValueOnce(contentResponse);
            
            const response = await handleRequest(request);
            const html = await response.text();
            
            expect(html).toContain('title-rewritten');
            expect(html).toContain('Test Title');
            expect(html).toContain('Test Description');
        });
    });

    describe('Error Handling', () => {
        it('should handle manifest 404', async () => {
            const request = new Request('https://example.com/path');
            global.fetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
            
            const response = await handleRequest(request);
            
            expect(response.status).toBe(404);
            expect(await response.text()).toBe('Review Not Found');
        });

        it('should handle manifest errors', async () => {
            const request = new Request('https://example.com/path');
            global.fetch.mockResolvedValueOnce(new Response(null, { status: 500 }));
            
            const response = await handleRequest(request);
            
            expect(response.status).toBe(500);
            expect(await response.text()).toBe('Manifest Error (500)');
        });
    });
}); 