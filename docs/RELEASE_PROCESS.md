# Release and Versioning Process

This document defines the release lifecycle, versioning guidelines, and release checklist for the OurDAO frontend application.

## Versioning Scheme

OurDAO Frontend adheres to [Semantic Versioning (SemVer 2.0.0)](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

- **MAJOR** (`x.0.0`): Incompatible frontend architectural breaks, breaking dependency upgrades, or changes requiring coordinated cutovers across `ourdao-contracts` and `ourdao-backend`.
- **MINOR** (`0.x.0`): New user-facing features, new pages, or significant enhancements introduced in a backward-compatible manner.
- **PATCH** (`0.0.x`): Backward-compatible bug fixes, security patches, visual/accessibility polish, and minor documentation fixes.

> Pre-1.0 (`0.x.y`): Rapid development phase. Minor releases may introduce breaking UI/schema changes when coordinated with contract updates.

## Changelog Policy

We follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

All member-visible changes landed in pull requests must include an entry under the `## [Unreleased]` section of [`CHANGELOG.md`](../CHANGELOG.md).

Sections:
- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be removed features.
- `Removed` for now removed features.
- `Fixed` for any bug fixes.
- `Security` in case of vulnerabilities.

Every release records:
1. Deployed backend commit/version (`ourdao-backend`).
2. Pinned contract commit (`ourdao-contracts` matching `contract/interface.json`).

## Release Checklist

When cutting a new release:

1. **Verify Compatibility**
   - Confirm pinned contract commit in `contract/interface.json` matches the intended on-chain deployment.
   - Confirm backend compatibility with `ourdao-backend`.

2. **Update CHANGELOG.md**
   - Create a new version heading under `## [Unreleased]`, for example:
     ```markdown
     ## [0.1.1] - 2026-10-16
     ```
   - Move all unreleased changes under this new version header.
   - Update the markdown reference links at the bottom of `CHANGELOG.md`:
     ```markdown
     [Unreleased]: https://github.com/ourdao/ourdao-frontend/compare/v0.1.1...HEAD
     [0.1.1]: https://github.com/ourdao/ourdao-frontend/compare/v0.1.0...v0.1.1
     ```

3. **Bump Version in package.json**
   - Update the `"version"` field in `package.json` to match the release version:
     ```json
     "version": "0.1.1"
     ```

4. **Commit and Tag**
   - Create a release commit:
     ```bash
     git commit -am "chore(release): v0.1.1"
     ```
   - Create an annotated git tag:
     ```bash
     git tag -a v0.1.1 -m "Release v0.1.1"
     ```

5. **Publish Tag & GitHub Release**
   - Push commit and tag to upstream:
     ```bash
     git push upstream main --follow-tags
     ```
   - Create a new Release in GitHub pointing to the tag, copying the corresponding section from `CHANGELOG.md`.
