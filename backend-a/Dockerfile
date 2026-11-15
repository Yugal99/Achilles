# Achilles scanner API with every scanner tool baked in (nmap, httpx, nuclei, testssl.sh).
# Build:  docker build -t achilles-backend backend-a
# Run:    docker run -p 8000:8000 -v achilles-data:/data --env-file .env achilles-backend
FROM python:3.12-slim-bookworm

ARG HTTPX_VERSION=1.12.0
ARG NUCLEI_VERSION=3.11.1

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ACHILLES_DATA_DIR=/data \
    ACHILLES_HTTPX_BIN=/usr/local/bin/httpx \
    ACHILLES_NUCLEI_BIN=/usr/local/bin/nuclei \
    # Only the curated templates in templates/achilles run. Pointing this at a missing dir means a
    # community set nuclei might download into ~/nuclei-templates is never picked up.
    ACHILLES_NUCLEI_TEMPLATES_DIR=/nonexistent

# testssl.sh needs hexdump (bsdextrautils) and dig (dnsutils).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      nmap testssl.sh bsdextrautils dnsutils procps ca-certificates curl unzip \
 && rm -rf /var/lib/apt/lists/*

# ProjectDiscovery httpx + nuclei, pinned and checksum-verified.
RUN set -eux; cd /tmp; \
    for spec in "httpx ${HTTPX_VERSION}" "nuclei ${NUCLEI_VERSION}"; do \
      set -- $spec; name=$1; ver=$2; \
      base="https://github.com/projectdiscovery/${name}/releases/download/v${ver}"; \
      curl -fsSLO "${base}/${name}_${ver}_linux_amd64.zip"; \
      curl -fsSLO "${base}/${name}_${ver}_checksums.txt"; \
      grep " ${name}_${ver}_linux_amd64.zip\$" "${name}_${ver}_checksums.txt" | sha256sum -c -; \
      unzip -o "${name}_${ver}_linux_amd64.zip" "${name}" -d /usr/local/bin; \
      chmod 755 "/usr/local/bin/${name}"; \
      rm -f /tmp/${name}_*; \
    done; \
    httpx -version; nuclei -version

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY templates ./templates
COPY lab ./lab

RUN useradd --create-home --uid 10001 achilles \
 && mkdir -p /data && chown achilles:achilles /data
USER achilles
VOLUME /data

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/v1/health >/dev/null || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
