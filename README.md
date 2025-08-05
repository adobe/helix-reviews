# helix-reviews

Develop this locally using the Cloudflare Wrangler CLI. For testing across both local development and CI branches, set a cookie with the project information.

## Local Development

To test the application, execute the following code snippet in your browser's developer console:

```javascript
document.cookie = "reviewHostname=my-snapshot--ref--project--org; path=/; max-age=3600";
```