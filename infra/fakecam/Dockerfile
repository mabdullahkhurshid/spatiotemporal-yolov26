FROM alpine:3.20

RUN apk add --no-cache ffmpeg

COPY run.sh /run.sh
# Checked out on Windows the script may have CRLF line endings.
RUN sed -i 's/\r$//' /run.sh

ENTRYPOINT ["/bin/sh", "/run.sh"]
