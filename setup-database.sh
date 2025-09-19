#!/bin/bash

echo "🚀 Video Streaming Platform Setup"
echo "================================="

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL first."
    echo "   On macOS: brew install postgresql"
    echo "   On Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "🔄 Starting PostgreSQL..."
    if command -v brew &> /dev/null; then
        brew services start postgresql
    elif command -v systemctl &> /dev/null; then
        sudo systemctl start postgresql
    fi
    sleep 3
fi

# Create database and user
echo "📊 Setting up database..."

# Try to connect as postgres user
if psql -U postgres -c "SELECT 1;" &> /dev/null; then
    echo "✅ Connected as postgres user"
    psql -U postgres -c "CREATE DATABASE video_streaming;" 2>/dev/null || echo "Database might already exist"
    psql -U postgres -c "CREATE USER video_user WITH PASSWORD 'video_password';" 2>/dev/null || echo "User might already exist"
    psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE video_streaming TO video_user;" 2>/dev/null || true
elif psql -U $(whoami) -c "SELECT 1;" &> /dev/null; then
    echo "✅ Connected as $(whoami) user"
    psql -U $(whoami) -c "CREATE DATABASE video_streaming;" 2>/dev/null || echo "Database might already exist"
else
    echo "❌ Cannot connect to PostgreSQL. Please check your PostgreSQL installation."
    echo "   Try running: sudo -u postgres psql"
    exit 1
fi

echo ""
echo "🔧 Database setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update your .env file with the correct database credentials:"
echo "   DB_USER=video_user"
echo "   DB_PASSWORD=video_password"
echo "   DB_NAME=video_streaming"
echo ""
echo "2. Run database migrations:"
echo "   npm run db:migrate"
echo ""
echo "3. Start the backend server:"
echo "   npm run dev"
echo ""
echo "🎉 Happy coding!"
