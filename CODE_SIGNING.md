# Code signing policy

BudTune publishes unsigned Windows previews while signing provider approval is pending. Windows Smart App Control may block these downloads.

App changes pushed to `main` trigger the release workflow. When the Windows, Linux, and macOS builds and tests pass, the release includes the portable `BudTune.exe` and the two platform archives. Release notes show the Windows signing status, SHA-256 checksums, and a link to the exact source commit.

The `publish_signed` option in **Actions → Release Windows app → Run workflow** submits the artifact for signing approval. This option requires the SignPath credentials below and a valid Authenticode signature before publishing. Once signing is available, update the push workflow to require signing for future automatic releases.

The repository owner, @SandhanuDulmeth, maintains the source and reviews pull requests. The repository owner is the intended signing approver. Future release approvers must use multifactor authentication and review the source and CI changes before approving a signing request.

## Provider setup

The workflow is prepared for SignPath. Foundation approval is separate. BudTune builds a modified OpenSCQ30 source tree, so disclose the upstream relationship and confirm the Foundation's upstream signing and fork criteria before onboarding. Do not claim Foundation signing until it is active.

Configure a release policy with manual approval and an artifact definition for BudTune.exe built by the Windows workflow. Set repository variables SIGNPATH_ORGANIZATION_ID, SIGNPATH_PROJECT_SLUG, SIGNPATH_POLICY_SLUG and SIGNPATH_ARTIFACT_SLUG. Put SIGNPATH_API_TOKEN in GitHub Actions secrets.

The Linux archive and macOS app are previews. The macOS bundle uses ad-hoc signing for the local build. Public macOS distribution through Gatekeeper requires Developer ID signing and Apple notarization.

## SourceForge downloads

For the current mirror, open **Files → v0.3.6 → BudTune.exe → File information** in SourceForge and choose **Default download for Windows**. Use the same file setting for Linux and macOS once their builds are available.

For future automatic mirrors, disable the SourceForge **Files → GitHub Integration** importer. Add `SOURCEFORGE_USERNAME` as a GitHub Actions repository variable for an account with file-release permissions on BudTune. Add a dedicated SSH private key as `SOURCEFORGE_SSH_KEY` and that account’s Releases API key as `SOURCEFORGE_RELEASE_API_KEY`. Register the corresponding SSH public key in the SourceForge account.

After the GitHub release is published, the mirror uploads the three app packages and a README linking to their corresponding source. The mirror then marks each package as the default for its own operating system. Existing SourceForge files can be managed in the Files interface.
