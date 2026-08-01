# Check IN Love 💕

<p align="center">
  <a href="https://github.com/aiThss/check-in-love/releases/latest">
    <img src="https://img.shields.io/badge/Android_App-Download_APK-2496ED?style=for-the-badge&logo=android&logoColor=white" alt="Download APK" />
  </a>
  <img src="https://img.shields.io/badge/PWA-Ready-FF3B7F?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA Ready" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Fastify-Backend-000000?style=for-the-badge&logo=fastify&logoColor=white" alt="Fastify" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

A private couple check-in application.

## 🏗️ Architecture

- **Backend**: Node.js + Fastify + TypeScript
- **Database**: MongoDB 7 (Mongoose)
- **PWA Frontend**: Vite + Vanilla TypeScript + Nginx
- **Admin Dashboard**: Vite + Vanilla TypeScript + Nginx
- **Android App**: Native Kotlin + Jetpack Compose + WebView

## 🚀 Quick Start (Development)

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your environment variables:
   ```bash
   cp .env.example .env
   ```

3. Run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

## 📄 License

Private project.
