# Achilles scanner API with every scanner tool baked in:
#   nmap, httpx, nuclei, testssl.sh, trufflehog, retire.js, arjun (+ the built-in JS/header check).
# Build:  docker build -t achilles-backend backend-a
# Run:    docker run -p 8000:8000 -v achilles-data:/data --env-file .env achilles-backend

# Retire.js needs Node >= 20.19; Debian's node is older, so take Node 22 from the official image.
FROM node:22-bookworm-slim AS node
ARG RETIRE_VERSION=6.1.1
RUN npm install -g --prefix /opt/retire "retire@${RETIRE_VERSION}" && /opt/retire/bin/retire --version

FROM python:3.12-slim-bookworm

ARG HTTPX_VERSION=1.12.0
ARG NUCLEI_VERSION=3.11.1
ARG TRUFFLEHOG_VERSION=3.99.9
ARG ARJUN_VERSION=2.2.7

# Third-party scanner binaries live in /opt/tools/bin, NOT /usr/local/bin: the Python `httpx`
# package (a backend dependency) installs its own `httpx` CLI there and would shadow ProjectDiscovery's.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH=/opt/tools/bin:/opt/retire/bin:$PATH \
    ACHILLES_DATA_DIR=/data \
    ACHILLES_HTTPX_BIN=/opt/tools/bin/httpx \
    ACHILLES_NUCLEI_BIN=/opt/tools/bin/nuclei \
    ACHILLES_TRUFFLEHOG_BIN=/opt/tools/bin/trufflehog \
    ACHILLES_RETIRE_BIN=/opt/retire/bin/retire \
    ACHILLES_ARJUN_BIN=/usr/local/bin/arjun \
    # Only the curated templates in templates/achilles run. Pointing this at a missing dir means a
    # community set nuclei might download into ~/nuclei-templates is never picked up.
    ACHILLES_NUCLEI_TEMPLATES_DIR=/nonexistent

# testssl.sh needs hexdump (bsdextrautils) and dig (dnsutils).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      nmap testssl.sh bsdextrautils dnsutils procps ca-certificates curl unzip \
 && rm -rf /var/lib/apt/lists/*

# ProjectDiscovery httpx + nuclei and TruffleHog: pinned release binaries, checksum-verified.
RUN set -eux; mkdir -p /opt/tools/bin; cd /tmp; \
    fetch() { owner=$1; name=$2; ver=$3; asset=$4; \
      base="https://github.com/${owner}/${name}/releases/download/v${ver}"; \
      curl -fsSLO "${base}/${asset}"; \
      curl -fsSLO "${base}/${name}_${ver}_checksums.txt"; \
      grep " ${asset}\$" "${name}_${ver}_checksums.txt" | sha256sum -c -; }; \
    fetch projectdiscovery httpx  "${HTTPX_VERSION}"  "httpx_${HTTPX_VERSION}_linux_amd64.zip"; \
    unzip -o "httpx_${HTTPX_VERSION}_linux_amd64.zip" httpx -d /opt/tools/bin; \
    fetch projectdiscovery nuclei "${NUCLEI_VERSION}" "nuclei_${NUCLEI_VERSION}_linux_amd64.zip"; \
    unzip -o "nuclei_${NUCLEI_VERSION}_linux_amd64.zip" nuclei -d /opt/tools/bin; \
    fetch trufflesecurity trufflehog "${TRUFFLEHOG_VERSION}" "trufflehog_${TRUFFLEHOG_VERSION}_linux_amd64.tar.gz"; \
    tar -xzf "trufflehog_${TRUFFLEHOG_VERSION}_linux_amd64.tar.gz" -C /opt/tools/bin trufflehog; \
    chmod 755 /opt/tools/bin/*; rm -rf /tmp/*; \
    /opt/tools/bin/httpx -version; /opt/tools/bin/nuclei -version; /opt/tools/bin/trufflehog --version

# Node runtime + retire.js from the node stage.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /opt/retire /opt/retire
RUN retire --version

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt "arjun==${ARJUN_VERSION}" \
 && test -x /usr/local/bin/arjun \
 && /opt/tools/bin/httpx -version 2>&1 | grep -qi projectdiscovery

COPY app ./app
COPY templates ./templates
COPY lab ./lab

RUN useradd --create-home --uid 10001 achilles \
 && mkdir -p /data && chown achilles:achilles /data \
 # nuclei logs an error every run without this file.
 && mkdir -p /home/achilles/.config/nuclei /home/achilles/.config/uncover \
 && touch /home/achilles/.config/nuclei/.nuclei-ignore \
 && chown -R achilles:achilles /home/achilles
USER achilles
VOLUME /data

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/v1/health >/dev/null || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
