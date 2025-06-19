# Calibre Web App

A modern web-based interface for browsing and downloading books from your local Calibre eBook library. Built with Vue 3, Node.js, and TypeScript, featuring OAuth authentication with manual approval workflow.

## 🚀 Features

- **📚 Book Browsing**: Browse your entire Calibre library with cover images, titles, authors, and descriptions
- **🔍 Advanced Search**: Search books by title, author, or publication year
- **📥 Secure Downloads**: Download books in various formats (EPUB, PDF, MOBI) with authentication
- **🔐 OAuth Authentication**: Secure login via Google OAuth with manual admin approval
- **👥 User Management**: Two-tier permission system (users and admins)
- **⚙️ Admin Panel**: Configure library settings, approve users, and manage the system
- **🔄 Auto Updates**: Automatically detects changes in your Calibre database
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **🐳 Docker Ready**: Containerized for easy deployment on any platform

## 🏗️ Architecture

This project follows a modern full-stack architecture:

- **Frontend**: Vue 3 with Composition API, TypeScript, Tailwind CSS
- **Backend**: Node.js with Express, TypeScript, SQLite (Calibre DB)
- **Authentication**: OAuth 2.0 with Google, JWT tokens
- **Database**: Direct access to Calibre's `metadata.db` SQLite file
- **Testing**: Vitest for unit testing
- **CI/CD**: GitHub Actions for automated testing

## 📋 Prerequisites

- Node.js 18.x or higher
- Docker and Docker Compose (for containerized deployment)
- A Calibre library with `metadata.db` file
- Google OAuth credentials (for authentication)

## 🛠️ Installation

### Option 1: Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CalibreWebApp
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Configure environment variables**
   
   Create `.env` files in both `backend/` and `frontend/` directories:
   
   **Backend (.env)**
   ```env
   NODE_ENV=development
   PORT=3000
   CALIBRE_DB_PATH=/path/to/your/calibre/library
   JWT_SECRET=your-jwt-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ADMIN_EMAIL=your-admin-email@example.com
   ```
   
   **Frontend (.env)**
   ```env
   VITE_API_BASE_URL=http://localhost:3000
   VITE_GOOGLE_CLIENT_ID=your-google-client-id
   ```

4. **Start the development servers**
   ```bash
   npm start
   ```

   This will start both frontend (http://localhost:8888) and backend (http://localhost:3000)

### Option 2: Docker Deployment

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CalibreWebApp
   ```

2. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   CALIBRE_DB_PATH=/path/to/your/calibre/library
   JWT_SECRET=your-jwt-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ADMIN_EMAIL=your-admin-email@example.com
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

   The application will be available at:
   - Frontend: http://localhost:8888
   - Backend API: http://localhost:3000

## 🔧 Configuration

### Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Create OAuth 2.0 credentials
5. Add your domain to authorized origins and redirect URIs
6. Copy the Client ID and Client Secret to your environment variables

### Calibre Library Path

Set the `CALIBRE_DB_PATH` environment variable to point to your Calibre library directory. The application will automatically detect and parse the `metadata.db` file.

## 🧪 Testing

Run the test suite:

```bash
# Run all tests (backend + frontend)
npm test

# Run backend tests only
cd backend && npm test

# Run frontend tests only
cd frontend && npm test
```

## 📁 Project Structure

```
CalibreWebApp/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── controllers/     # API controllers
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── types/           # TypeScript type definitions
│   └── tests/               # Backend unit tests
├── frontend/                # Vue 3 frontend
│   ├── src/
│   │   ├── components/      # Vue components
│   │   ├── views/           # Page components
│   │   ├── stores/          # Pinia stores
│   │   ├── router/          # Vue Router configuration
│   │   └── api/             # API client
│   └── tests/               # Frontend unit tests
├── data/                    # Mounted Calibre library data
├── docker-compose.yml       # Docker Compose configuration
└── .github/workflows/       # GitHub Actions CI/CD
```

## 🔐 Authentication & Authorization

### User Roles

- **Users**: Can browse and download books after approval
- **Admins**: Can approve users, configure settings, and access admin features

### Approval Process

1. New users authenticate via Google OAuth
2. Admin receives email notification of pending approval
3. Admin approves/rejects the user through the admin panel
4. User gains access to the library after approval

## 🚀 Deployment

### Synology NAS

1. Install Docker and Docker Compose on your Synology NAS
2. Mount your Calibre library as a volume
3. Configure environment variables
4. Run with Docker Compose

### Other Platforms

The application is containerized and can be deployed on any platform that supports Docker:
- Home servers
- Cloud platforms (AWS, Google Cloud, Azure)
- VPS providers

## 🔄 Auto Updates

The application automatically detects changes in your Calibre library:
- Scheduled polling every 5 minutes
- Triggered updates on user login
- Real-time database reloading

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues:

1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed information
3. Include logs and environment details

## 🔮 Roadmap

- [ ] User bookshelves and favorites
- [ ] Tag-based browsing
- [ ] Download history and activity logs
- [ ] Enhanced admin interface
- [ ] Mobile app support
- [ ] Multi-language support

---

**Note**: This application requires access to a Calibre library. Make sure you have the necessary permissions and that your Calibre database is properly configured.
