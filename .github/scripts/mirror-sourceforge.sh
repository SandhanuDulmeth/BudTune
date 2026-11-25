#!/usr/bin/env bash
set -euo pipefail

tag=$1
release_dir=$2
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
[[ "${SOURCEFORGE_USERNAME:?Set SOURCEFORGE_USERNAME}" =~ ^[a-zA-Z0-9_-]+$ ]]
: "${SOURCEFORGE_SSH_KEY:?Set SOURCEFORGE_SSH_KEY}"
: "${SOURCEFORGE_RELEASE_API_KEY:?Set SOURCEFORGE_RELEASE_API_KEY}"

files=(BudTune.exe BudTune-Linux-x64.tar.gz BudTune-macOS-arm64.zip)
platforms=(windows linux mac)
for file in "${files[@]}"; do
  test -s "$release_dir/$file"
done

work_dir=$(mktemp -d)
trap 'rm -rf -- "$work_dir"' EXIT
umask 077
printf '%s\n' "$SOURCEFORGE_SSH_KEY" > "$work_dir/key"
ssh-keyscan -T 15 -t ed25519 frs.sourceforge.net > "$work_dir/known_hosts"
fingerprint=$(ssh-keygen -E sha256 -lf "$work_dir/known_hosts" | awk '{print $2}' | sort -u)
if [[ "$fingerprint" != 'SHA256:209BDmH3jsRyO9UeGPPgLWPSegKmYCBIya0nR/AWWCY' ]]; then
  echo 'SourceForge file server SSH fingerprint did not match.' >&2
  exit 1
fi

cat > "$work_dir/README.md" <<EOF
# BudTune $tag

| Platform | File |
| --- | --- |
| Windows x64 | BudTune.exe |
| Linux x64 | BudTune-Linux-x64.tar.gz |
| macOS Apple Silicon | BudTune-macOS-arm64.zip |

[Corresponding source and build instructions](https://github.com/$GITHUB_REPOSITORY/tree/$GITHUB_SHA)

[Release notes and checksums](https://github.com/$GITHUB_REPOSITORY/releases/tag/$tag)
EOF

sftp -b - -i "$work_dir/key" -o BatchMode=yes -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$work_dir/known_hosts" \
  "$SOURCEFORGE_USERNAME@frs.sourceforge.net" <<EOF
cd /home/frs/project/budtune
-mkdir $tag
cd $tag
put "$release_dir/BudTune.exe"
put "$release_dir/BudTune-Linux-x64.tar.gz"
put "$release_dir/BudTune-macOS-arm64.zip"
put "$work_dir/README.md"
EOF

for index in "${!files[@]}"; do
  file=${files[index]}
  platform=${platforms[index]}
  url="https://sourceforge.net/projects/budtune/files/$tag/$file"
  for attempt in {1..8}; do
    if response=$(curl --fail --silent --show-error --max-time 30 --request PUT \
      --header 'Accept: application/json' \
      --data-urlencode "default=$platform" \
      --data-urlencode "api_key=$SOURCEFORGE_RELEASE_API_KEY" "$url") &&
      jq -e --arg platform "$platform" --arg file "$file" \
        '(.error | not) and .result.name == $file and
         (.result.x_sf.default | split(",") | index($platform) != null)' \
        <<< "$response" > /dev/null; then
      echo "SourceForge default for $platform is $tag/$file."
      break
    fi
    if [[ "$attempt" == 8 ]]; then
      echo "Could not set the SourceForge default for $platform to $tag/$file." >&2
      exit 1
    fi
    sleep 10
  done
done
