/**
 * Cloudflare Worker for AEM Review System
 * This worker handles authentication, routing, and content delivery for AEM review/preview environments.
 * It supports password protection, meta tag rewriting, and proper routing for snapshots.
 */

import { parse } from 'cookie';

// Constants
const AEM_DOMAIN = 'aem';
const DEFAULT_HOSTNAME = 'default--main--aem-boilerplate--adobe.aem.reviews';

/**
 * Helper Functions
 */

/**
 * Creates an HTML meta tag with the given name and value
 * @param {string} name - The name attribute of the meta tag
 * @param {string} value - The content attribute of the meta tag
 * @returns {string} The formatted meta tag HTML
 */
const createMetaTag = (name, value) => `<meta name="${name}" content="${value}">\n`;

/**
 * Gets the hostname to determine if it's a reviews domain or needs to use a default or passed in hostname
 * @param {URL} url - The request URL
 * @returns {string} The processed hostname
 */
const getHostname = (url) => {
    const isReviewsDomain = url.hostname.endsWith('.hlx.reviews') || url.hostname.endsWith('.aem.reviews');
    return isReviewsDomain ? url.hostname : (new URLSearchParams(url.search).get('hostname') || DEFAULT_HOSTNAME);
};

/**
 * Extracts review information from the hostname
 * Format: reviewId--ref--repo--owner
 * @param {string} hostname - The hostname to parse
 * @returns {Object} Object containing reviewId, ref, repo, and owner
 */
const extractReviewInfo = (hostname) => {
    const origin = hostname.split('.')[0];
    const [reviewId, ref, repo, owner] = origin.split('--');
    return { reviewId, ref, repo, owner };
};

/**
 * Creates a redirect response for snapshot URLs
 * Removes the /.snapshots/{reviewId} prefix from the path
 * @param {string} pathname - The original pathname
 * @returns {Response} A redirect response
 */
const createSnapshotRedirect = (pathname) => {
    const location = `/${pathname.split('/').slice(3).join('/')}`;
    return new Response('Redirect', {
        status: 302,
        headers: {
            location,
            'content-type': 'text/plain;charset=UTF-8'
        }
    });
};

/**
 * Generates a robots.txt file for the review site
 * @param {string} hostname - The hostname of the review site
 * @returns {Response} A response containing the robots.txt content
 */
const generateRobotsTxt = (hostname) => {
    const robots = `User-agent: *
Allow: /

Sitemap: https://${hostname}/sitemap.xml`;
    return new Response(robots, {
        headers: {
            'content-type': 'text/plain;charset=UTF-8'
        }
    });
};

/**
 * Generates a sitemap.xml for the review site
 * Combines pages from both the manifest and the original site's sitemap
 * @param {string} hostname - The hostname of the review site
 * @param {Array} pages - Array of page paths from the manifest
 * @param {Object} reviewInfo - Review information object
 * @returns {Response} A response containing the sitemap XML
 */
const generateSitemap = async (hostname, pages, reviewInfo, incomingRequest) => {
    const indexedPages = [];
    try {
        const sitemapRequest = new Request(incomingRequest);
        sitemapRequest.headers.set('accept-encoding', 'identity');
        
        const sitemapUrl = `https://${reviewInfo.ref}--${reviewInfo.repo}--${reviewInfo.owner}.${AEM_DOMAIN}.page/sitemap.xml`;
        const sitemapResp = await fetch(sitemapUrl, sitemapRequest);
        const xml = await sitemapResp.text();
        const regexp = /<loc>(.*?)<\/loc>/g;
        const sitemapLocs = [...xml.matchAll(regexp)].map((e) => new URL(e[1]).pathname);
        indexedPages.push(...sitemapLocs);
    } catch (error) {
        console.log('No sitemap index found');
    }

    const allPages = [...new Set([...pages, ...indexedPages])];
    const urls = allPages.map((path) => `https://${hostname}${path}`);
    
    const sitemap = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
    ${urls.map((url) => `<url><loc>${url}</loc></url>`).join('\n')}
    </urlset>`;

    return new Response(sitemap, {
        headers: {
            'content-type': 'text/xml;charset=UTF-8'
        }
    });
};

/**
 * Rewrites meta tags in the HTML response based on metadata rules
 * @param {Response} response - The original response
 * @param {URL} url - The request URL
 * @param {Object} reviewInfo - Review information object
 * @returns {string} The modified HTML content
 */
const rewriteMetaTags = async (response, url, reviewInfo, incomingRequest) => {
    if (response.status !== 200) return response.body;

    const metadataRequest = new Request(incomingRequest);
    metadataRequest.headers.set('accept-encoding', 'identity');

    const metadataUrl = `https://${reviewInfo.ref}--${reviewInfo.repo}--${reviewInfo.owner}.${AEM_DOMAIN}.page/.snapshots/${reviewInfo.reviewId}/metadata.json`;
    const metadataResponse = await fetch(metadataUrl, metadataRequest);
    const metadata = await metadataResponse.json();
    
    const html = await response.text();
    let [headContent] = html.split('</head>');
    const rules = metadata.data;

    rules.forEach((rule) => {
        const pattern = rule.URL.replaceAll('**', '.*');
        const regex = new RegExp(pattern);
        
        if (regex.test(url.pathname)) {
            Object.entries(rule).forEach(([key, value]) => {
                const name = key.toLowerCase();
                if (name !== 'url' && value) {
                    headContent = headContent
                        .replace(`<meta name="${name}"`, `<meta name="${name}-rewritten"`)
                        + createMetaTag(name, value);
                }
            });
        }
    });

    return headContent + '</head>' + html.split('</head>')[1];
};

/**
 * Checks if the request is authenticated using the review password
 * @param {Object} metadata - The review metadata containing the password
 * @param {Request} request - The original request
 * @param {Object} reviewInfo - Review information object
 * @param {Object} env - The environment variables
 * @returns {Promise<boolean>} Whether the request is authenticated
 */
const checkAuthentication = async (metadata, request, reviewInfo, env) => {
    if (!metadata?.reviewPassword) return true;
    if (request.headers.get('authorization') === `token ${env[`${reviewInfo.owner}-org-token`]}`) return true;

    const cookies = parse(request.headers.get('cookie') || '');
    const sha256 = async (message) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const reviewPasswordHash = await sha256(metadata.reviewPassword);
    return cookies.reviewPassword === reviewPasswordHash;
};

/**
 * Main request handler for the Cloudflare Worker
 * Handles routing, authentication, and content delivery for the review system
 * @param {Request} request - The incoming request
 * @param {Object} env - The environment variables
 * @returns {Promise<Response>} The response to send back to the client
 */
async function handleRequest(request, env) {
  try {
    const url = new URL(request.url);

    const { method, headers } = request;

    // disable conditional requests
    let m = new Map(headers);
    m.delete('if-none-match');
    m.delete('if-modified-since');
    const incomingRequest = new Request(url, { method, headers: Object.fromEntries(m) });

    // Handle snapshot redirects
    if (url.pathname.startsWith('/.snapshots/') && !url.pathname.endsWith('.manifest.json')) {
        return createSnapshotRedirect(url.pathname);
    }

    // Parse hostname and review information
    const hostname = getHostname(url);
    const reviewInfo = extractReviewInfo(hostname);

    // Fetch manifest
    const manifestUrl = `https://${reviewInfo.ref}--${reviewInfo.repo}--${reviewInfo.owner}.${AEM_DOMAIN}.page/.snapshots/${reviewInfo.reviewId}/.manifest.json`;
    const manifestRequest = new Request(incomingRequest);
    manifestRequest.headers.set('accept-encoding', 'identity');
    // since we re-use incoming request headers, we don't want to end up fetching partial manifests
    manifestRequest.headers.delete('range');
    if (env[`${reviewInfo.owner}-org-token`]) {
        manifestRequest.headers.set('authorization', `token ${env[`${reviewInfo.owner}-org-token`]}`);
    }
    
    const manifestResponse = await fetch(manifestUrl, manifestRequest);

    // Handle 404
    if (manifestResponse.status === 404) {
        return new Response('Review Not Found', {
            status: 404,
            headers: {
                'content-type': 'text/plain;charset=UTF-8'
            }
        });
    }

    // Handle special routes
    if (url.pathname === '/sitemap.xml' || url.pathname === '/sitemap-origin.xml') {
        const manifest = await manifestResponse.json();
        return generateSitemap(hostname, manifest.resources.map(e => e.path), reviewInfo, incomingRequest);
    }

    if (url.pathname === '/robots.txt') {
        return generateRobotsTxt(hostname);
    }

    // Check authentication
    if (manifestResponse.status === 200) {
        const manifest = await manifestResponse.json();
        const isAuthenticated = await checkAuthentication(manifest.metadata, request, reviewInfo, env);
        if (!isAuthenticated) {
            return new Response(
                '<html><head><title>Unauthorized</title><script src="https://labs.aem.live/tools/snapshot-admin/401.js"></script></head><body><h1>Unauthorized</h1></body>',
                {
                    status: 401,
                    headers: {
                        'content-type': 'text/html'
                    }
                }
            );
        }
    // Handle content request
    let pathname = url.pathname;
    if (pathname.endsWith('.plain.html')) {
        pathname = pathname.split('.')[0];
    }

    const pages = manifest.resources.map(e => e.path);
    const isPageSnapshot = pages.includes(pathname);
    
    if (isPageSnapshot) {
        url.pathname = `/.snapshots/${reviewInfo.reviewId}${url.pathname}`;
    }

    if (url.pathname.endsWith('/.manifest.json')) {
        url.hostname = `${reviewInfo.ref}--${reviewInfo.repo}--${reviewInfo.owner}.${AEM_DOMAIN}.page`;
    } else {
        url.hostname = `${reviewInfo.ref}--${reviewInfo.repo}--${reviewInfo.owner}.${AEM_DOMAIN}.${isPageSnapshot ? 'page' : 'live'}`;
    }

    const contentRequest = new Request(url, incomingRequest);
    contentRequest.headers.set('x-forwarded-host', contentRequest.headers.get('host'));
    contentRequest.headers.delete('x-push-invalidation');
    if (isAuthenticated && env[`${reviewInfo.owner}-org-token`]) {
        contentRequest.headers.set('authorization', `token ${env[`${reviewInfo.owner}-org-token`]}`);
    }

    const contentResponse = await fetch(url.toString(), contentRequest);
    let body = contentResponse.body;

    // Rewrite meta tags if needed
    if (pages.includes('/metadata.json') && !url.pathname.split('/').pop().includes('.')) {
        body = await rewriteMetaTags(contentResponse, url, reviewInfo, incomingRequest);
    }

    const response = new Response(body, contentResponse);
    response.headers.set('x-origin-url', url.toString());
    response.headers.set('x-robots-tag', 'noindex,nofollow');

    return response;

    } else {
        return new Response(`Manifest Error (${manifestResponse.status})`, {
            status: manifestResponse.status,
            headers: {
                'content-type': 'text/plain;charset=UTF-8'
            }
        });
    }
  } catch (error) {
    console.error('Error in handleRequest:', error, error.stack);
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

export default {
    async fetch(request, env) {
        return handleRequest(request, env);
    }
}