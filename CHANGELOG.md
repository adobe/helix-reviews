## [1.1.1](https://github.com/adobe/helix-reviews/compare/v1.1.0...v1.1.1) (2025-09-01)


### Bug Fixes

* address PR review comments - restore console.log and simplify destructuring ([d8c7c1c](https://github.com/adobe/helix-reviews/commit/d8c7c1ce5f87d26d8dd18ea2f593160443ebe4ee))
* make codebase ESLint compliant ([da5cbb5](https://github.com/adobe/helix-reviews/commit/da5cbb5c728af6d8a7039eb04fff23eb58dbc020))
* use proper destructuring where ESLint requires it ([97a93fb](https://github.com/adobe/helix-reviews/commit/97a93fb52e504e84ea9ef6060a743e47479bc4ad))

# [1.1.0](https://github.com/adobe/helix-reviews/compare/v1.0.0...v1.1.0) (2025-09-01)


### Features

* Protected content allow passing an auth token ([#13](https://github.com/adobe/helix-reviews/issues/13)) ([8c18e85](https://github.com/adobe/helix-reviews/commit/8c18e85e8e4d40be745fedb9ee4ee6186f1a98bd))

# 1.0.0 (2025-08-28)


### Bug Fixes

* add missing package-lock.json for npm ci ([5088cc1](https://github.com/adobe/helix-reviews/commit/5088cc12f2f129c2e033a0a9a45cd3eb90e3e525))
* add proper permissions and use automatic GITHUB_TOKEN for semantic-release workflow ([9810a8f](https://github.com/adobe/helix-reviews/commit/9810a8fa5fee0b57f8276d65d3de9ef890460f75))
* disbale conditional requests ([a098128](https://github.com/adobe/helix-reviews/commit/a098128af5dcdffadf42d79967c4ab5f4335efcd))
* refactor issues ([182aba9](https://github.com/adobe/helix-reviews/commit/182aba9af8981341856b8bd97ffba21a9eefdb9c))
* remove redundant cf-deploy.yaml workflow ([c92a0c6](https://github.com/adobe/helix-reviews/commit/c92a0c6a9c30df078d96d4dc25bc90bc66ad3bb8))
* rename .eslintrc.js to .eslintrc.cjs for ES module compatibility ([dc5e67c](https://github.com/adobe/helix-reviews/commit/dc5e67c78c8c952d47d827b837997d672d0cd693))
* rename .releaserc.js to .releaserc.cjs for ES module compatibility ([62746dc](https://github.com/adobe/helix-reviews/commit/62746dcd916750c59f0608ecd4bc605b0f5a6e4e))
* temporarily skip linting in CI workflow ([7c99df0](https://github.com/adobe/helix-reviews/commit/7c99df0243fa25bf4f98277368f18863cc93da9e))
* update post-deploy tests to use correct CI domain ([ae69022](https://github.com/adobe/helix-reviews/commit/ae69022433ba0fa04e42c274d2921ef77b84cb6a))
* update workflows to use CF_API_KEY instead of CLOUDFLARE_API_TOKEN ([d27d9ce](https://github.com/adobe/helix-reviews/commit/d27d9ce7a86fc41e4c4df5b3f7f823e22c987a9e))
* use .page for snapshot metadata ([74a04bd](https://github.com/adobe/helix-reviews/commit/74a04bdbfa05a387743431bfa014cf3dadb5dec8))


### Features

* add GitHub Actions workflows for CI/CD ([45c0d40](https://github.com/adobe/helix-reviews/commit/45c0d40e90e53e68791fc29d06d0b649c4ba0114))
* add npm package configuration and semantic-release setup ([d8240a6](https://github.com/adobe/helix-reviews/commit/d8240a6dcae8503b93219d4d483b5ed25f86b2f2))
* add post-deployment integration tests ([c879162](https://github.com/adobe/helix-reviews/commit/c8791629a3e09d49a36bb5fd4babc3212d18f34c))
* initial commit ([92f342a](https://github.com/adobe/helix-reviews/commit/92f342a6cada8ef678dbc775302aa42b1427741d))
