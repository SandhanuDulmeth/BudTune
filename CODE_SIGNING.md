# Code signing policy

BudTune 0.2.1 was published unsigned. A trusted Windows signature requires approval and credentials from a code-signing provider. BudTune has no active signing certificate at present.

The Windows workflow builds and tests every candidate. Publishing a new Windows release requires a manual workflow run from main with signing enabled. It submits the CI artifact for approval and checks that Windows reports a valid Authenticode signature before publishing. The release checksum is computed from the signed executable.

The repository owner, @SandhanuDulmeth, maintains the source and reviews pull requests. The repository owner is the intended signing approver. Future release approvers must use multifactor authentication and review the source and CI changes before approving a signing request.

## Provider setup

The workflow is prepared for SignPath. Foundation approval is separate. BudTune builds a modified OpenSCQ30 source tree, so disclose the upstream relationship and confirm the Foundation's upstream signing and fork criteria before onboarding. Do not claim Foundation signing until it is active.

Configure a release policy with manual approval and an artifact definition for BudTune.exe built by the Windows workflow. Set repository variables SIGNPATH_ORGANIZATION_ID, SIGNPATH_PROJECT_SLUG, SIGNPATH_POLICY_SLUG and SIGNPATH_ARTIFACT_SLUG. Put SIGNPATH_API_TOKEN in GitHub Actions secrets.

The Linux archive and macOS app are previews. The macOS bundle uses ad-hoc signing for the local build. Public macOS distribution through Gatekeeper requires Developer ID signing and Apple notarization.
