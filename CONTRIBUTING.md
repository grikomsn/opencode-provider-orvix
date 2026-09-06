# Contributing

Thanks for helping improve the Orvix provider for OpenCode.

## Before opening work

- Use [Discussions](https://github.com/grikomsn/opencode-provider-orvix/discussions/categories/q-a) for setup and usage questions.
- Search existing issues before filing a bug or feature request.
- Report vulnerabilities according to [SECURITY.md](SECURITY.md), not in a public issue.
- Keep changes focused. Open an issue first when a proposal changes authentication, provider behavior, or published model metadata.

## Development

Use Node.js 22 or newer:

```sh
npm install
npm run check
npm run package
```

Add or update tests when behavior changes. Do not commit `.env` files, API keys, tarballs, or `node_modules/`.

User-visible changes need a Changeset:

```sh
npm run changeset
```

Documentation, tests, and repository-maintenance-only changes do not need one.

## Pull requests

A pull request should:

- Explain the problem and the chosen solution
- Stay limited to one coherent change
- Pass tests and package validation
- Update documentation when authentication, model metadata, or user workflows change
- Avoid unrelated dependency or formatting churn

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). For contribution questions not suited to Discussions, contact [griko@nibras.co](mailto:griko@nibras.co).
