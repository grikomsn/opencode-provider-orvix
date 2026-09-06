# Releasing

Releases are managed by Changesets and `.github/workflows/release.yml`.

## npm trusted publishing

The package has already been bootstrapped on npm. Its trusted publisher must remain configured with:

- Organization or user: `grikomsn`
- Repository: `opencode-provider-orvix`
- Workflow filename: `release.yml`
- Environment: leave blank
- Allowed action: `npm publish`

No long-lived `NPM_TOKEN` is used by GitHub Actions. The release job runs on a GitHub-hosted runner, receives `id-token: write`, uses npm 11.5.1 or newer, and publishes with provenance.

## Release flow

1. Add a changeset to each user-visible pull request with `npm run changeset`.
2. Changesets maintains a `chore: version package` pull request against `main`.
3. Merge that pull request.
4. The release workflow validates the package and runs `npm publish --access public --provenance` through npm trusted publishing.
5. The workflow creates the matching `v<version>` GitHub release.

If npm publication succeeds but the workflow fails before creating the GitHub release, rerun the release workflow. Its version checks skip the existing npm version and create the missing `v<version>` release without republishing.
