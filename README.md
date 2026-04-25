# Quiz System - Backend

An Express.js REST API for live polling and quiz sessions. Uses MySQL with Sequelize ORM.

## Tech Stack

- **Express.js** - Web framework
- **Sequelize** - ORM for MySQL
- **MySQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Multer** - File uploads
- **Sharp** - Image processing
- **Helmet** - Security headers
- **ws** - WebSocket server

## Project Structure

```
backend/src/
├── server.js                 # Entry point, starts HTTP server
├── app.js                  # Express app configuration
├── config/
│   ├── database.js         # Sequelize connection
│   ├── env.js           # Environment variables
│   └── multer.js        # File upload config
├── models/
│   ├── index.js          # Model setup & associations
│   ├── user.model.js    # Host/admin users
│   ├── client.model.js  # Client/organization
│   ├── department.model.js  # Department
│   ├── session.model.js  # Quiz/poll session
│   ├── participant.model.js  # Session participants
│   ├── question.model.js  # Questions
│   ├── question-option.model.js  # MCQ options
│   ├── response.model.js  # Participant responses
│   ├── qa-question.model.js  # Q&A questions
│   ├── qa-upvote.model.js  # Q&A upvotes
│   └── media-asset.model.js  # Uploaded media
├── routes/
│   ├── index.js          # Route aggregator
│   ├── auth.routes.js    # Authentication
│   ├── client.routes.js  # Client management
│   ├── department.routes.js  # Department management
│   ├── session.routes.js  # Session CRUD
│   ├── question.routes.js  # Question CRUD
│   ├── response.routes.js  # Response handling
│   ├── qa.routes.js    # Q&A functionality
│   ├── media.routes.js  # Media uploads
│   └── analytics.routes.js  # Analytics data
├── controllers/
│   ├── auth.controller.js
│   ├── client.controller.js
│   ├── department.controller.js
│   ├── session.controller.js
│   ├── question.controller.js
│   ├── response.controller.js
│   ├── qa.controller.js
│   ├── media.controller.js
│   └── analytics.controller.js
├── services/
│   ├── auth.service.js
│   ├── client.service.js
│   ├── department.service.js
│   ├── session.service.js
│   ├── question.service.js
│   ├── response.service.js
│   ├── qa.service.js
│   ├── media.service.js
│   ├── analytics.service.js
│   └── websocket.service.js    # WebSocket handling
├── middlewares/
│   ├── auth.middleware.js      # JWT verification
│   ├── role.middleware.js     # Role checks
│   ├── participant-auth.middleware.js  # Participant auth
│   └── qa-access.middleware.js    # Q&A access
├── validators/
│   ├── auth.validator.js
│   ├── client.validator.js
│   ├── department.validator.js
│   ├── session.validator.js
│   ├── question.validator.js
│   ├── response.validator.js
│   ├── qa.validator.js
│   └── media.validator.js
└── utils/
    ├── response.js        # Response helpers
    ├── jwt.js         # JWT helpers
    └── media.js       # Media helpers
```

## Database Models

### User
- `user_id` (PK)
- `client_id` (FK)
- `dept_id` (FK, nullable)
- `email` - Unique
- `password` - Hashed
- `name`
- `role` - admin, host
- `created_at`, `updated_at`

### Client
- `client_id` (PK)
- `name`
- `domain`
- `created_at`, `updated_at`

### Department
- `dept_id` (PK)
- `client_id` (FK)
- `name`
- `created_at`, `updated_at`

### Session
- `session_id` (PK)
- `session_code` - Unique 6-char code for joining
- `host_id` (FK -> User)
- `dept_id` (FK -> Department)
- `title`
- `description`
- `status` - draft, live, paused, completed, archived
- `is_anonymous_default`
- `max_participants`
- `show_results_to_participants`
- `allow_late_join`
- `leaderboard_enabled`
- `started_at`, `ended_at`
- `created_at`, `updated_at`

### Participant
- `participant_id` (PK)
- `session_id` (FK)
- `dept_id` (FK)
- `name`
- `email`
- `total_score`
- `created_at`, `updated_at`

### Question
- `question_id` (PK)
- `session_id` (FK)
- `dept_id` (FK)
- `question_type` - mcq, word_cloud, rating, open_text, true_false, ranking
- `question_text`
- `is_quiz_mode`
- `points_value`
- `time_limit_seconds`
- `allow_multiple_select`
- `display_order`
- `created_at`, `updated_at`

### QuestionOption
- `option_id` (PK)
- `question_id` (FK)
- `option_text`
- `is_correct`
- `display_order`

### Response
- `response_id` (PK)
- `session_id` (FK)
- `participant_id` (FK)
- `question_id` (FK)
- `option_id` (FK, nullable)
- `text_response`
- `score`
- `created_at`

### QaQuestion
- `qa_id` (PK)
- `session_id` (FK)
- `dept_id` (FK)
- `participant_id` (FK)
- `question_text`
- `moderation_status` - pending, approved, rejected
- `answer_text`
- `answered_by` (FK -> User)
- `is_pinned`
- `created_at`, `updated_at`

### QaUpvote
- `upvote_id` (PK)
- `qa_id` (FK)
- `participant_id` (FK)
- `created_at`

### MediaAsset
- `media_id` (PK)
- `dept_id` (FK)
- `uploaded_by` (FK -> User)
- `file_url`
- `file_type`
- `file_size`
- `created_at`

## API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /login` - Login with email/password
- `POST /refresh` - Refresh access token
- `GET /me` - Get current user

### Clients (`/api/v1/clients`)
- `GET /` - List clients
- `POST /` - Create client
- `GET /:id` - Get client
- `PUT /:id` - Update client
- `DELETE /:id` - Delete client

### Departments (`/api/v1/departments`)
- `GET /` - List departments
- `POST /` - Create department
- `GET /:id` - Get department
- `PUT /:id` - Update department
- `DELETE /:id` - Delete department

### Sessions (`/api/v1/sessions`)
- `GET /` - List sessions
- `POST /` - Create session
- `GET /:id` - Get session
- `PUT /:id` - Update session
- `DELETE /:id` - Delete session
- `POST /:id/start` - Start session
- `POST /:id/pause` - Pause session
- `POST /:id/end` - End session
- `GET /:id/qr` - Get session QR

### Questions (`/api/v1/questions`)
- `GET /session/:sessionId` - List questions for session
- `POST /` - Create question
- `PUT /:id` - Update question
- `DELETE /:id` - Delete question
- `PUT /reorder` - Reorder questions

### Responses (`/api/v1/responses`)
- `POST /` - Submit response
- `GET /session/:sessionId` - Get session responses

### Q&A (`/api/v1/qa`)
- `GET /session/:sessionId` - Get Q&A questions
- `POST /` - Submit Q&A question
- `PUT /:id` - Update Q&A (answer)
- `POST /:id/upvote` - Upvote Q&A
- `DELETE /:id/upvote` - Remove upvote

### Media (`/api/v1/media`)
- `POST /` - Upload media
- `GET /:id` - Get media info
- `DELETE /:id` - Delete media

### Analytics (`/api/v1/analytics`)
- `GET /dashboard` - Dashboard stats
- `GET /session/:sessionId` - Session analytics

## Authentication

### Host Authentication (JWT)
1. Login with email/password
2. Receive access_token (15min) + refresh_token (7 days)
3. Include `Authorization: Bearer <token>` in requests
4. Use refresh_token to get new access_token

### Participant Authentication
- Anonymous sessions: auto-generate participant on join
- Name only: require name
- Name + email: require name + email
- Session-specific token generated

## Middleware

- `auth.middleware.js` - Verifies JWT, attaches user to req
- `role.middleware.js` - Checks user roles (admin/host)
- `participant-auth.middleware.js` - Verifies participant token
- `qa-access.middleware.js` - Checks Q&A permissions

## Media Uploads

- Stored in `backend/uploads/`
- Subdirectories: `images/`, `videos/`
- Max file size: 50MB
- Supported: images, videos, audio
- Sharp used for image resizing/processing

## Environment Variables

```
NODE_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=quiz_db
DB_USER=root
DB_PASSWORD=

JWT_SECRET=
JWT_REFRESH_SECRET=
```

## Commands

```bash
npm install      # Install dependencies
npm run dev     # Start dev server with nodemon
npm start       # Start production server
```

## Live Result Dashboard

The system supports real-time result dashboards during live sessions.

### Dashboard Metrics (Per Active Question)
- Total responses received
- Response rate: responses / total joined participants
- Live updating - new responses animate in real time
- Time elapsed since question went live

### Chart Types
- **Pie chart** - ideal for MCQ with fewer than 6 options
- **Horizontal bar chart** - default for MCQ, shows option label + count + %
- **Word cloud** - for open word submissions
- **Live feed** - scrolling list for open text responses
- **Number gauge / donut** - for NPS / rating average
- **Leaderboard card** - top 10 participants by score

### Session Summary Overlay (End of Session)
- Total participants who joined
- Total questions answered
- Average response rate across all questions
- Final leaderboard (top 10)
- Most popular response per question

## WebSocket Server

The backend includes a WebSocket server for real-time communication during live sessions.

### Connection URL
- WebSocket endpoint: `/ws`
- Query parameters: `session` (required), `token` (optional), `role` (optional)

### Connection Example
```javascript
const ws = new WebSocket("ws://localhost:5000/ws?session=ABC123&role=host")
```

### Server Events (Broadcast)

| Event | Description |
|-------|-------------|
| `connected` | Connection established confirmation |
| `response_received` | New participant response with live results |
| `session_updated` | Session status changed (live/paused/completed) |
| `question_changed` | Current question changed |
| `leaderboard_update` | Leaderboard rankings updated |

### Client Messages

| Message | Description |
|--------|-------------|
| `ping` | Heartbeat |
| `submit_answer` | Submit answer (participant) |

### Live Results Data

When `response_received` is broadcast, the payload includes:

```javascript
{
  type: "response_received",
  response: {
    question_id: 1,
    participant_id: 5,
    option_id: 2,
    text_response: null
  },
  results: {
    question_id: 1,
    question_type: "mcq",
    total_responses: 25,
    by_option: { "1": 10, "2": 15 },
    text_responses: [],
    average_rating: null
  }
}
```

### Implementation

See `src/services/websocket.service.js` for the WebSocket implementation. The service:
- Manages active connections by session code
- Handles reconnection on disconnect
- Broadcasts events to all clients in a session
- Integrates with response submission for real-time updates

## Database

SQL schema available in `quiz_db.sql` at project root.