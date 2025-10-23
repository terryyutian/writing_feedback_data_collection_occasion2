# Use the official Python 3.11 image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ENV=production
ENV DEBUG=false

# Set working directory
WORKDIR /app

# Copy only requirements first (for layer caching)
COPY backend/requirements.txt ./backend/requirements.txt

# Install dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy backend and frontend files
COPY backend/ ./backend/
COPY frontend_rev/ ./frontend_rev/

# Copy the startup script and make it executable
COPY backend/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose the port uvicorn will run on
EXPOSE 8000

# Use the custom startup script to seed and launch app
CMD ["/app/start.sh"]
