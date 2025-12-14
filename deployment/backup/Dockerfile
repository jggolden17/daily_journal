FROM google/cloud-sdk:alpine

# NOTE: need same pg version for pg_dump to work, 
# apk default is v16, I want v17, so need to install from edge repository
RUN echo 'http://dl-cdn.alpinelinux.org/alpine/edge/main' >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache gzip bc postgresql17-client

COPY backup/backup-job.sh /backup-job.sh
RUN chmod +x /backup-job.sh
COPY setup-scripts/scripts-utils.sh /scripts-utils.sh
RUN chmod +x /scripts-utils.sh

WORKDIR /app

ENTRYPOINT ["/backup-job.sh"]
