# Live Polling Backend

Node 18 backend API for live polling using Express + Sequelize + MySQL 8.

## Structure

- `src/models` - Sequelize models
- `src/services` - business logic
- `src/controllers` - request handlers
- `src/routes` - API routes
- `src/middlewares` - auth middleware

## Setup

1. Install dependencies:
   - `npm install`
2. Ensure MySQL 8 is running and `quiz_db.sql` is imported.
3. Update `.env` with DB and JWT values.
4. Run API:
   - `npm run dev` (development)
   - `npm start` (production-like)

## Auth APIs

Base URL: `http://localhost:5000/api/v1`

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me` (Bearer token required)
- `GET /health`

### Register payload

```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "role": "host",
  "client_id": 1,
  "dept_id": 1
}
```
