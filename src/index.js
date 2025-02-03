(() => {
  // src/index.js
  addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
  });
  async function handleRequest(request) {
    const url = new URL(request.url);

    const createMetaTag = (name, value) => {
      return `<meta name="${name}" content="${value}">\n`;
    };

    const rewriteMeta = async (data) => {
      if (data.status !== 200) return data.body;
      const metadataURL = `https://${ref}--${repo}--${owner}.${aem}.${state}/.snapshots/${reviewId}/metadata.json`;
      const metaresp = await fetch(metadataURL, request);
      const metadata = await metaresp.json();
      const html = await data.text();
      const headSplits = html.split('</head>');
      const rules = metadata.data;
      rules.forEach((rule) => {
        const pattern = rule.URL.replaceAll('**', '.*');
        const regex = new RegExp(pattern);
        if (regex.test(url.pathname)) {
          const metanames = Object.keys(rule);
          metanames.forEach((metaname) => {
            const name = metaname.toLowerCase();
            if (name !== 'url' && rule[metaname]) {
              headSplits[0] = headSplits[0].replace(`<meta name="${name}"`, `<meta name="${name}-rewritten"`);
              headSplits[0] = headSplits[0] + createMetaTag(name, rule[metaname]);
            }
          });

        }
      });
      const modBody = headSplits.join('</head>');
      return modBody;
    };

    const createSnapshotRedirect = (pathname2) => {
      const location = `/${pathname2.split("/").slice(3).join("/")}`;
      return new Response("Redirect", {
        status: 302,
        headers: {
          location,
          "content-type": "text/plain;charset=UTF-8"
        }
      });
    };
    console.log(url.pathname);
    if (url.pathname.startsWith("/.snapshots/") && !url.pathname.endsWith(".manifest.json")) {
      return createSnapshotRedirect(url.pathname);
    }
    const hostname = (url.hostname.endsWith(".hlx.reviews") || url.hostname.endsWith(".aem.reviews")) ? url.hostname : "default--main--aem-boilerplate--adobe.aem.reviews";
    const origin = hostname.split(".")[0];
    const [reviewId, ref, repo, owner] = origin.split("--");
    const aem = 'aem';
    const adminUrl = `https://${ref}--${repo}--${owner}.${aem}.page/.snapshots/${reviewId}/.manifest.json`;
    console.log("adminurl", adminUrl, request.headers.get("accept-encoding"));
    const newreq = new Request(request);
    newreq.headers.set("accept-encoding", "identity");
    const resp = await fetch(adminUrl, newreq);
    const manifestStatus = resp.status;
    if (resp.status === 404) {
      return new Response("Review Not Found", {
        status: 404,
        headers: {
          "content-type": "text/plain;charset=UTF-8"
        }
      });
    }

    const pages = [];

    if (resp.status === 200) {
      const json = await resp.json();
      pages.push(...json.resources.map((e) => e.path));
    }

    const createRobots = async () => {
      const robots = `User-agent: *
Allow: /

Sitemap: https://${url.hostname}/sitemap.xml`;
      return new Response(robots, {
        headers: {
          "content-type": "text/plain;charset=UTF-8"
        }
      });
    };

    const createReviewSitemap = async () => {
      const indexedPages = [];
      try {
        const sitemapResp = await fetch(`https://${ref}--${repo}--${owner}.${aem}.page/sitemap.xml`, request);
        const xml = await sitemapResp.text();
        const regexp = /<loc\>(.*?)\<\/loc>/g;
        const sitemapLocs = [...xml.matchAll(regexp)].map((e) => new URL(e[1]).pathname);
        indexedPages.push(...sitemapLocs);
      } catch {
        console.log("no index");
      }
      pages.push(...indexedPages);
      const urls = [...new Set(pages.map((path) => `https://${url.hostname}${path}`))];
      const sitemap = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
    ${urls.map((e) => "<url><loc>" + e + "</loc></url>").join("\n")}
    </urlset>`;
      return new Response(sitemap, {
        headers: {
          "content-type": "text/xml;charset=UTF-8"
        }
      });
    };

    if (url.pathname === "/sitemap.xml" || url.pathname === "/sitemap-origin.xml")
      return await createReviewSitemap();
    if (url.pathname === "/robots.txt")
      return createRobots();
    let pathname = url.pathname;
    if (pathname.endsWith(".plain.html"))
      pathname = pathname.split(".")[0];
    let state = pages.includes(pathname) ? "page" : "live";
    if (state === "page") {
      url.pathname = `/.snapshots/${reviewId}${url.pathname}`;
    }

    if (url.pathname.endsWith("/.manifest.json")) {
      state = 'page';
    }
    url.hostname = `${ref}--${repo}--${owner}.${aem}.${state}`;

    const req = new Request(url, request);
    req.headers.set("x-forwarded-host", req.headers.get("host"));
    req.headers.delete("x-push-invalidation");
    const data = await fetch(url.toString(), req);
    let body = data.body;
    if (pages.includes('/metadata.json') && !url.pathname.split('/').pop().includes('.')) {
      body = await rewriteMeta(data);
    }
    const response = new Response(body, data);
    // response.headers.set("content-security-policy", "");
    response.headers.set("x-origin-url", url.toString());
    response.headers.set("x-robots-tag", 'noindex,nofollow');
    // response.headers.set("x-debug", `manifest: ${manifestStatus} : ${pathname}: [${pages.join(",")}]`);
    return response;
  }
})();