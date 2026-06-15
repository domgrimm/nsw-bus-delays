FROM python:3.12-slim

WORKDIR /app

RUN groupadd -r nswbus && useradd -r -g nswbus nswbus

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY app/ app/

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8000

USER nswbus

CMD ["/start.sh"]
