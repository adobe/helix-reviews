## Description
Install the [wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) and run `wrangler dev` to start a local instance.

## CI/CD & Testing Changes
Push to a branch to get this deployed on a CI branch for testing; push to main to get this deployed to production.

On the CI branch, you can add a query parameter such as `?hostname=snapshot--main--project--organization` to pull in a specific snapshot for testing purposes.
