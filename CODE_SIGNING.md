# Code signing policy

BudTune publishes unsigned Windows previews while signing provider approval is pending. Windows Smart App Control may block these downloads.

App changes pushed to `main` trigger the Windows workflow. After the build and tests pass, it publishes the portable `BudTune.exe` as a GitHub Release and labels the unsigned preview in its release notes. Each release lists the SHA-256 checksum of the published executable.

The `publish_signed` option in **Actions → Release Windows app → Run workflow** submits the artifact for signing approval. This option requires the SignPath credentials below and a valid Authenticode signature before publishing. Once signing is available, update the push workflow to require signing for future automatic releases.

The repository owner, @SandhanuDulmeth, maintains the source and reviews pull requests. The repository owner is the intended signing approver. Future release approvers must use multifactor authentication and review the source and CI changes before approving a signing request.

## Provider setup

The workflow is prepared for SignPath. Foundation approval is separate. BudTune builds a modified OpenSCQ30 source tree, so disclose the upstream relationship and confirm the Foundation's upstream signing and fork criteria before onboarding. Do not claim Foundation signing until it is active.

Configure a release policy with manual approval and an artifact definition for BudTune.exe built by the Windows workflow. Set repository variables SIGNPATH_ORGANIZATION_ID, SIGNPATH_PROJECT_SLUG, SIGNPATH_POLICY_SLUG and SIGNPATH_ARTIFACT_SLUG. Put SIGNPATH_API_TOKEN in GitHub Actions secrets.

The Linux archive and macOS app are previews. The macOS bundle uses ad-hoc signing for the local build. Public macOS distribution through Gatekeeper requires Developer ID signing and Apple notarization.
