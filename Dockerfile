FROM python:3.12-alpine

WORKDIR /app

COPY index.html styles.css app.js server.py project-idea.md ./
COPY assets ./assets

ENV HOUSEHOLD_DATA_DIR=/data
ENV PORT=8080

VOLUME ["/data"]
EXPOSE 8080

CMD ["python", "server.py"]
