FROM moby/buildkit:v0.12.2@sha256:8ea9857f95c2a0402c245bb0e94f36e2b5b4a1cb05e7ed322c213ed50607ce62 as buildkit

RUN apk add --no-cache wget

# ECR credential helper
RUN cd /usr/local/bin && \
  wget https://amazon-ecr-credential-helper-releases.s3.us-east-2.amazonaws.com/0.6.0/linux-amd64/docker-credential-ecr-login && \
  echo "af805202cb5d627dde2e6d4be1f519b195fd5a3a35ddc88d5010b4a4e5a98dd8  docker-credential-ecr-login" | sha256sum -c && \
  chmod +x docker-credential-ecr-login

# GCR credential helper
RUN wget "https://github.com/GoogleCloudPlatform/docker-credential-gcr/releases/download/v2.0.1/docker-credential-gcr_linux_amd64-2.0.1.tar.gz" && \
  echo "90837d1d9cf16809a60d5c7891d7d0b8445b1978ad43187032a0ca93bda49ed5  docker-credential-gcr_linux_amd64-2.0.1.tar.gz" | sha256sum -c && \
  tar xzf docker-credential-gcr_linux_amd64-2.0.1.tar.gz --to-stdout ./docker-credential-gcr \
  > /usr/local/bin/docker-credential-gcr && \
  chmod +x /usr/local/bin/docker-credential-gcr && \
  rm docker-credential-gcr_linux_amd64-2.0.1.tar.gz

FROM moby/buildkit:v0.12.2-rootless@sha256:0919807170af622451887366c17408dc9a946d04c6fe4fcca3071f9637f8598f as buildkit-rootless

COPY --from=buildkit /usr/local/bin/docker-credential-ecr-login /usr/local/bin/docker-credential-ecr-login
COPY --from=buildkit /usr/local/bin/docker-credential-gcr /usr/local/bin/docker-credential-gcr
