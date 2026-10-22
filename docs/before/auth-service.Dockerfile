FROM python:3.12
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["sh","-c","python manage.py seed && gunicorn -b 0.0.0.0:5000 app:app"]
