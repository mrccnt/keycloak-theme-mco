#!/usr/bin/env bash
# Creates (or updates) an OpenID Connect client in the master realm of the
# running dev server (`make dev`) that can be used for the OAuth 2.0 Device
# Authorization Grant, then prints client_id, client_secret and the URLs.
#
#   tools/create-device-client.sh [client_id]
#
# Environment overrides:
#   KC_URL        Keycloak base URL      (default: http://localhost:8080)
#   KC_REALM      target realm           (default: master)
#   KC_ADMIN      admin username         (default: admin)
#   KC_ADMIN_PW   admin password         (default: admin)
#   CLIENT_ID     client id              (default: device-client, or $1)
#
# Requires: curl, jq, base64

set -euo pipefail

KC_URL="${KC_URL:-http://localhost:8080}"
KC_URL="${KC_URL%/}"
KC_REALM="${KC_REALM:-master}"
KC_ADMIN="${KC_ADMIN:-admin}"
KC_ADMIN_PW="${KC_ADMIN_PW:-admin}"
CLIENT_ID="${1:-${CLIENT_ID:-device-client}}"

die() { echo "error: $*" >&2; exit 1; }

for cmd in curl jq; do
	command -v "$cmd" >/dev/null || die "'$cmd' is required but not installed"
done

# --- admin access token ------------------------------------------------------
TOKEN="$(curl -sf -X POST "${KC_URL}/realms/master/protocol/openid-connect/token" \
	-d grant_type=password \
	-d client_id=admin-cli \
	--data-urlencode "username=${KC_ADMIN}" \
	--data-urlencode "password=${KC_ADMIN}_PW" | jq -r '.access_token // empty')" \
	|| die "cannot reach Keycloak at ${KC_URL} (is \`make dev\` running?)"
[[ -n "${TOKEN}" ]] || die "admin login failed for user '${KC_ADMIN}'"

api() {
	local method="$1" path="$2"; shift 2
	curl -sf -X "${method}" "${KC_URL}/admin/realms/${KC_REALM}${path}" \
		-H "Authorization: Bearer ${TOKEN}" \
		-H "Content-Type: application/json" "$@"
}

# --- client representation ---------------------------------------------------
CLIENT_JSON="$(jq -n --arg id "${CLIENT_ID}" '{
	clientId: $id,
	name: "Device Code Client",
	description: "Dev client for the OAuth 2.0 Device Authorization Grant",
	protocol: "openid-connect",
	enabled: true,
	publicClient: false,
	clientAuthenticatorType: "client-secret",
	standardFlowEnabled: false,
	implicitFlowEnabled: false,
	directAccessGrantsEnabled: false,
	serviceAccountsEnabled: false,
	attributes: {
		logoUri: "https://marcoconti.org/images/favicons/favicon-96.png",
		"oauth2.device.authorization.grant.enabled": "true",
		"oidc.ciba.grant.enabled": "false"
	}
}')"

# --- create or update --------------------------------------------------------
UUID="$(api GET "/clients?clientId=$(jq -rn --arg v "${CLIENT_ID}" '$v|@uri')" | jq -r '.[0].id // empty')" \
	|| die "cannot query clients in realm '$KC_REALM'"

if [[ -n "$UUID" ]]; then
	api PUT "/clients/$UUID" -d "$CLIENT_JSON" >/dev/null || die "updating client '${CLIENT_ID}' failed"
	echo "Updated existing client '${CLIENT_ID}' in realm '$KC_REALM'." >&2
else
	api POST "/clients" -d "$CLIENT_JSON" >/dev/null || die "creating client '${CLIENT_ID}' failed"
	UUID="$(api GET "/clients?clientId=$(jq -rn --arg v "${CLIENT_ID}" '$v|@uri')" | jq -r '.[0].id // empty')"
	[[ -n "$UUID" ]] || die "client '${CLIENT_ID}' not found after creation"
	echo "Created client '${CLIENT_ID}' in realm '$KC_REALM'." >&2
fi

SECRET="$(api GET "/clients/$UUID/client-secret" | jq -r '.value // empty')"
[[ -n "${SECRET}" ]] || die "cannot read client secret"

# --- output ------------------------------------------------------------------
OIDC="${KC_URL}/realms/$KC_REALM/protocol/openid-connect"

cat <<EOF

client_id:                ${CLIENT_ID}
client_secret:            ${SECRET}
url:                      ${KC_URL}/realms/$KC_REALM
issuer / discovery:       ${KC_URL}/realms/$KC_REALM/.well-known/openid-configuration
device_authorization:     $OIDC/auth/device
token:                    $OIDC/token
verification_uri:         ${KC_URL}/realms/$KC_REALM/device

EOF

echo "Sending device auth request"
curl \
  -s \
  -X POST \
  "$OIDC/auth/device" \
  -d client_id="${CLIENT_ID}" \
  -d client_secret="${SECRET}" \
  -d scope=openid \
  | jq . > auth.json

# show verification url:
echo " > Visit $(jq -r .verification_uri_complete auth.json)"
echo " > Use admin/admin as credentials"
echo " > Consent"

echo -n " > Checking status..."
for ((i = 0; i < 120; i++)); do
  sleep 5
  echo -n "."
  curl \
    -s \
    -X POST \
    "${OIDC}/token" \
    -d grant_type=urn:ietf:params:oauth:grant-type:device_code \
    -d client_id="${CLIENT_ID}" \
    -d client_secret="${SECRET}" \
    -d device_code="$(jq -r .device_code auth.json)" \
    -o temp.json
  if [[ "$(jq -r .access_token temp.json)" != "" && "$(jq -r .access_token temp.json)" != "null" ]]; then
    rm auth.json
    break
  fi
  rm -f temp.json
done
echo ""

echo ""

if [[ -f temp.json ]]; then
  payload=$(jq -er '.access_token | split(".")[1]' temp.json | tr '_-' '/+') || exit
  while (( ${#payload} % 4 )); do payload+='='; done
  n="$(printf '%s' "$payload" | base64 -d | jq -r '.preferred_username')"
  echo "Authenticated - Hello ${n}!"
  rm -f temp.json
else
  echo "Could not authenticate..."
fi

rm -f auth.json temp.json

exit 0
