FROM python:3.12-slim

WORKDIR /app

RUN groupadd -r nswbus && useradd -r -g nswbus nswbus

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY app/ app/

USER nswbus

CMD ["python", "-m", "app.main"]
