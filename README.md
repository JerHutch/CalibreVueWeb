# Calibre Web Interface - Requirements Document

## Project Overview
This project aims to create a web-based interface to a local Calibre eBook library. The website will allow users to browse, search, and download books stored in a Calibre database. It will also include user authentication via OAuth with a manual approval process and support dynamic updates of the backend data source.

## Goals
- Provide a clean, user-friendly front end for browsing and downloading books from a Calibre database.
- Support search by book title, author, or publication year.
- Secure the application with OAuth-based authentication and manual approval.
- Automatically detect and update book listings when changes occur in the underlying Calibre database.

## Technical Requirements

### Backend (Node.js)
- **Language**: JavaScript / TypeScript
- **Framework**: Express.js
- **Database Access**:
  - Parse the Calibre `metadata.db` SQLite file.
  - Monitor for changes in the file (e.g., using file system watchers or scheduled polling).
  - Support reloading the database on schedule or on user login.
- **Authentication**:
  - Implement OAuth2 login (e.g., with Google or GitHub).
  - When a new user authenticates, create a pending access request.
  - Send an approval request to a configured admin email address.
  - Do not allow access until the user has been manually approved.
  - Support two permission levels: **users** and **admins**.
    - Users can browse and download books.
    - Admins can approve users and access configuration options.
    - Initially, only the project owner will be assigned admin privileges.
- **API Endpoints**:
  - `/api/books`: Get all books
  - `/api/books?search=...`: Search books by title, author, or publication year
  - `/api/books/:id`: Get metadata for a specific book
  - `/api/books/:id/download`: Download the book file

### Frontend (Vue 3 and Vite)
- **Language**: JavaScript / TypeScript
- **Framework**: Vue 3 with Composition API
- **Pages/Views**:
  - Login Page
  - Book List View (with thumbnails, titles, authors, descriptions)
  - Book Detail Page (with download link)
  - Search results
  - Pending Access Notice Page
  - Admin Configuration Page
- **Features**:
  - Display cover images
  - Provide download links for eBooks (e.g., EPUB, PDF, MOBI)
  - Filter/search by title, author, or year
  - Responsive layout for mobile and desktop
  - Admin can configure:
    - Location of the Calibre library
    - Interval for checking updates
    - Email address for sending authentication approval requests
    - Approve or reject pending user access requests

### Tooling
- **Build Tool**: Vite
- **Test Framework**: Vitest

## Non-Functional Requirements
- **Security**:
  - Require login and manual approval before accessing book content
  - Protect download links from unauthenticated or unapproved users
  - Restrict admin features to users with admin permissions
- **Performance**:
  - Support incremental loading of books for large libraries
- **Scalability**:
  - Codebase should support future deployment on small home servers or cloud platforms
- **Maintainability**:
  - Use modular code structure
  - Write unit tests for core logic
- **Deployment**:
  - Application must be containerized using Docker
  - Provide a Dockerfile and `docker-compose.yml` for building and running the application
  - Expose appropriate ports for frontend and backend services
  - Allow volume mounting for the Calibre library path and configuration files
  - Ensure compatibility with deployment on a Synology NAS Docker environment

## Schedule and Updates
- Detect changes in `metadata.db` file using either:
  - A scheduled job (e.g., every 5 minutes)
  - Triggered update on user login
- Rebuild or reload the in-memory catalog upon change detection

## Future Enhancements (Optional)
- User bookshelf or favorites
- Tag-based browsing
- Download history or activity logs
- Admin interface to manage library settings

---
This document serves as the initial requirements definition for the Calibre Web Interface project. It will be revised as development progresses.

