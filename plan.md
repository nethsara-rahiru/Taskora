# Taskora V1 — Full Implementation Plan

## 1. System Introduction

### 1.1 Product Name

**Taskora**

### 1.2 Product Type

Taskora is a web-based personal task management and productivity application designed to help users organize, schedule, track, and complete their daily tasks.

The system will provide users with a clean and simple interface for managing tasks, projects, priorities, deadlines, recurring tasks, reminders, and productivity information.

A key feature of Taskora V1 is its **WhatsApp notification system**. Instead of depending on browser notifications, Taskora will use the **FrontDesk Agents API** to send task reminders and other notifications to the user's WhatsApp account.

Taskora V1 will intentionally avoid AI and unnecessary infrastructure. The goal is to build a reliable, maintainable, and expandable foundation that can later support more advanced features.

### 1.3 Main Objectives

The V1 system should allow a user to:

* Create and manage tasks
* Organize tasks into projects/lists
* Set priorities
* Set due dates and times
* Create subtasks
* Add tags
* Mark tasks as completed
* Search, filter, and sort tasks
* Create recurring tasks
* Configure reminders
* Receive reminders through WhatsApp
* View today's, upcoming, overdue, and completed tasks
* View basic productivity statistics
* Manage their account and preferences
* Access their tasks from different devices

### 1.4 V1 Philosophy

Taskora V1 should follow these principles:

1. **Simple**
2. **Fast**
3. **Reliable**
4. **Easy to maintain**
5. **Mobile-friendly**
6. **Secure**
7. **Expandable**

We should not introduce technologies merely because they are popular.

---

# 2. Technology Stack

## 2.1 Frontend

* HTML5
* CSS3
* Vanilla JavaScript

No React or other frontend framework will be used in V1.

### Frontend responsibilities

* Render pages
* Handle user interactions
* Communicate with the REST API
* Manage UI state
* Display tasks
* Display notifications/status messages
* Validate basic user input
* Handle authentication state

---

# 3. Backend

## 3.1 Backend Technologies

* Node.js
* Express.js
* JavaScript

The backend will expose a REST API consumed by the frontend.

### Backend responsibilities

* Authentication
* Authorization
* Task management
* Project management
* Tag management
* Reminder management
* Recurring task processing
* WhatsApp notification requests
* User settings
* Dashboard data
* Database communication
* Server-side validation
* Error handling

---

# 4. Database

## 4.1 Database

**MongoDB**

MongoDB will store all application data.

The database should be designed so that each user's data is properly isolated.

Main collections:

```text
users
projects
tasks
tags
reminders
notifications
sessions (optional)
```

---

# 5. Authentication

Taskora will have its own authentication system.

## 5.1 V1 Authentication Features

* User registration
* User login
* User logout
* Password hashing
* Authentication cookies
* Protected API routes
* User profile
* Password change
* Account deletion

Passwords must NEVER be stored as plain text.

Use a secure password hashing library such as:

```text
bcrypt
```

or

```text
argon2
```

---

# 6. Authentication Architecture

Preferred approach:

```text
Browser
   ↓
Login API
   ↓
Backend verifies credentials
   ↓
Create authenticated session/token
   ↓
HTTP-only cookie
   ↓
Browser
```

The frontend should not store authentication tokens in localStorage if an HTTP-only cookie approach can be used.

Every protected API request must verify the authenticated user.

---

# 7. Project Structure

Initial project structure:

```text
taskora/
│
├── package.json
├── .env
├── .gitignore
├── README.md
│
├── server/
│   │
│   ├── server.js
│   │
│   ├── config/
│   │   ├── database.js
│   │   └── config.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── task.routes.js
│   │   ├── project.routes.js
│   │   ├── tag.routes.js
│   │   ├── reminder.routes.js
│   │   └── dashboard.routes.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── task.controller.js
│   │   ├── project.controller.js
│   │   ├── tag.controller.js
│   │   ├── reminder.controller.js
│   │   └── dashboard.controller.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Task.js
│   │   ├── Project.js
│   │   ├── Tag.js
│   │   ├── Reminder.js
│   │   └── Notification.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── task.service.js
│   │   ├── reminder.service.js
│   │   ├── notification.service.js
│   │   └── whatsapp.service.js
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   └── validation.middleware.js
│   │
│   └── scheduler/
│       ├── scheduler.js
│       ├── reminder.worker.js
│       └── recurring.worker.js
│
└── public/
    │
    ├── index.html
    ├── login.html
    ├── register.html
    ├── dashboard.html
    ├── tasks.html
    ├── projects.html
    ├── calendar.html
    ├── settings.html
    │
    ├── css/
    │   ├── main.css
    │   ├── components.css
    │   ├── dashboard.css
    │   └── responsive.css
    │
    └── js/
        ├── api.js
        ├── auth.js
        ├── app.js
        ├── tasks.js
        ├── projects.js
        ├── calendar.js
        ├── settings.js
        └── components/
            ├── task-card.js
            ├── modal.js
            ├── sidebar.js
            └── notification.js
```

The structure can be changed during implementation if a better organization becomes necessary.

---

# 8. Database Design

## 8.1 Users Collection

Example:

```text
users
{
    _id,
    name,
    email,
    passwordHash,

    whatsapp: {
        enabled,
        phoneNumber,
        verified
    },

    preferences: {
        theme,
        timezone,
        defaultReminder
    },

    createdAt,
    updatedAt
}
```

---

# 9. Projects Collection

```text
projects
{
    _id,
    userId,
    name,
    description,
    icon,
    color,
    archived,
    createdAt,
    updatedAt
}
```

Each project belongs to one user.

---

# 10. Tasks Collection

A task should contain:

```text
tasks
{
    _id,

    userId,

    projectId,

    parentTaskId,

    title,
    description,

    status,

    priority,

    dueDate,
    dueTime,

    tags,

    completedAt,

    recurring,

    createdAt,
    updatedAt
}
```

### Status

Initial statuses:

```text
pending
in_progress
completed
cancelled
```

The initial UI can keep this simple even if the backend supports several statuses.

### Priority

```text
low
medium
high
urgent
```

---

# 11. Subtasks

Subtasks should be represented using:

```text
parentTaskId
```

Example:

```text
Main Task
   ├── Subtask 1
   ├── Subtask 2
   └── Subtask 3
```

This approach keeps subtasks as normal task documents while maintaining the relationship.

---

# 12. Tags

Tags can be stored separately:

```text
tags
{
    _id,
    userId,
    name,
    color,
    createdAt
}
```

Tasks can reference tag IDs.

Example:

```text
Task
 ├── Work
 ├── Important
 └── University
```

---

# 13. Reminders

Reminders should be separate database records.

Example:

```text
reminders
{
    _id,

    userId,
    taskId,

    reminderTime,

    channel,

    status,

    sentAt,

    createdAt
}
```

### Channel

V1:

```text
whatsapp
```

Later:

```text
email
push
sms
```

can be added.

### Status

```text
pending
processing
sent
failed
cancelled
```

---

# 14. Notifications

Store notification history.

```text
notifications
{
    _id,

    userId,
    taskId,
    reminderId,

    type,
    channel,

    message,

    status,

    sentAt,
    error,

    createdAt
}
```

This allows the user/admin system to determine whether a notification was successfully sent.

---

# 15. WhatsApp Integration

Taskora will NOT directly implement the WhatsApp infrastructure.

Instead:

```text
Taskora
    ↓
FrontDesk Agents API
    ↓
WhatsApp
    ↓
User
```

The WhatsApp functionality should be isolated inside:

```text
whatsapp.service.js
```

This means the rest of Taskora doesn't need to know how FrontDesk works internally.

---

# 16. WhatsApp Configuration

Environment variables should contain the required FrontDesk API configuration.

Example:

```text
FRONTDESK_API_URL=
FRONTDESK_API_KEY=
FRONTDESK_AGENT_ID=
```

Actual names should be finalized according to the FrontDesk API specification.

Secrets must never be placed directly inside frontend JavaScript.

---

# 17. WhatsApp Notification Flow

Example task:

```text
Task:
Submit assignment

Due:
September 5, 6:00 PM

Reminder:
September 5, 5:00 PM
```

Flow:

```text
User creates task
        ↓
Task stored in MongoDB
        ↓
Reminder stored
        ↓
Scheduler waits
        ↓
Reminder becomes due
        ↓
Notification service
        ↓
WhatsApp service
        ↓
FrontDesk Agents API
        ↓
WhatsApp
        ↓
User
```

---

# 18. Notification Scheduler

V1 does not need Redis or BullMQ.

Use a Node.js background scheduler.

The scheduler periodically checks MongoDB for reminders that need to be processed.

Example:

```text
Every 30 seconds
       ↓
Find pending reminders
       ↓
Is reminder time reached?
       ↓
Yes
       ↓
Send WhatsApp
       ↓
Mark reminder as sent
```

The exact polling interval can be adjusted.

---

# 19. Preventing Duplicate Notifications

The system must prevent the same reminder from being sent multiple times.

Before sending:

```text
status = pending
```

While processing:

```text
status = processing
```

After successful sending:

```text
status = sent
```

If sending fails:

```text
status = failed
```

The scheduler must not send reminders already marked as:

```text
sent
```

---

# 20. Recurring Tasks

V1 should support basic recurring tasks.

Examples:

```text
Every day
Every week
Every month
Every year
```

Possible configuration:

```text
recurring:
{
    enabled,
    frequency,
    interval,
    daysOfWeek,
    endDate
}
```

Example:

```text
Every Monday at 9:00 AM
```

When the task becomes completed or reaches its recurrence point, the system creates/schedules the next occurrence according to the recurrence configuration.

---

# 21. Main Pages

## 21.1 Landing Page

Contains:

* Taskora branding
* Short product description
* Features
* Login button
* Register button

---

# 22. Login Page

Fields:

```text
Email
Password
```

Actions:

```text
Login
Forgot password
Create account
```

---

# 23. Registration Page

Fields:

```text
Name
Email
Password
Confirm Password
```

After registration:

```text
Account created
       ↓
Login
       ↓
Dashboard
```

---

# 24. Dashboard

The dashboard is the main screen.

Display:

```text
Good morning, User

Today
──────────────
5 tasks

Completed
──────────────
3 tasks

Overdue
──────────────
1 task

Upcoming
──────────────
7 tasks
```

Main sections:

* Today's tasks
* Upcoming tasks
* Overdue tasks
* Recently completed
* Quick add task

---

# 25. Task Interface

Task card should display:

```text
☐ Complete assignment

Priority: High
Due: Today 6:00 PM
Project: University
Tags: Important
```

Actions:

```text
Complete
Edit
Delete
More
```

---

# 26. Create Task

Task creation form:

```text
Title
Description

Project

Priority

Due Date
Due Time

Reminder

Recurring

Tags

Subtasks
```

The form should be quick to use.

A user should be able to create a simple task by entering only:

```text
Title
```

Everything else should be optional.

---

# 27. Task Details

Task details should allow:

* Edit title
* Edit description
* Change priority
* Change project
* Change due date
* Change reminder
* Manage subtasks
* Manage tags
* Mark complete
* Delete task

---

# 28. Projects Page

Display projects such as:

```text
University
Work
Personal
Shopping
Projects
```

Actions:

```text
Create project
Edit project
Archive project
Delete project
```

---

# 29. Calendar Page

V1 calendar should provide:

* Monthly view
* Tasks displayed on dates
* Click date to view tasks
* Click task to open details

Calendar does not need to be overly complicated in V1.

---

# 30. Search

Users should be able to search tasks by:

* Title
* Description
* Tags
* Project

Example:

```text
Search: assignment
```

Results:

```text
Submit assignment
Complete assignment report
Assignment presentation
```

---

# 31. Filtering

Supported filters:

```text
Status
Priority
Project
Tag
Due date
```

Example:

```text
Priority = High
Status = Pending
Project = University
```

---

# 32. Sorting

Supported sorting:

```text
Due date
Priority
Created date
Updated date
Alphabetical
```

---

# 33. Task Views

Initial views:

```text
All Tasks
Today
Upcoming
Overdue
Completed
```

Later:

```text
Custom views
Kanban
Timeline
```

can be considered.

---

# 34. Settings

Settings page should contain:

### Account

```text
Name
Email
Password
```

### WhatsApp

```text
WhatsApp number
Enable notifications
Disable notifications
Test notification
```

### Preferences

```text
Theme
Timezone
Default reminder
```

---

# 35. WhatsApp Setup

The user should be able to configure WhatsApp notifications.

Basic flow:

```text
Settings
   ↓
WhatsApp Notifications
   ↓
Enter WhatsApp number
   ↓
Verification
   ↓
Enable notifications
```

The exact verification process depends on the FrontDesk Agents API capabilities.

---

# 36. API Design

Use REST APIs.

Base:

```text
/api
```

---

# 37. Authentication APIs

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

---

# 38. User APIs

```text
GET    /api/user
PUT    /api/user
PUT    /api/user/password
DELETE /api/user
```

---

# 39. Task APIs

```text
GET    /api/tasks
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id

POST   /api/tasks/:id/complete
POST   /api/tasks/:id/uncomplete
```

---

# 40. Subtask APIs

```text
GET    /api/tasks/:id/subtasks
POST   /api/tasks/:id/subtasks
```

Or subtasks can use the standard task API with:

```text
parentTaskId
```

The second approach is preferred because subtasks remain normal tasks.

---

# 41. Project APIs

```text
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects
PUT    /api/projects/:id
DELETE /api/projects/:id
POST   /api/projects/:id/archive
```

---

# 42. Tag APIs

```text
GET    /api/tags
POST   /api/tags
PUT    /api/tags/:id
DELETE /api/tags/:id
```

---

# 43. Reminder APIs

```text
GET    /api/reminders
POST   /api/reminders
PUT    /api/reminders/:id
DELETE /api/reminders/:id
```

---

# 44. Dashboard API

```text
GET /api/dashboard
```

It should return information such as:

```text
todayTasks
completedToday
overdueTasks
upcomingTasks
completionRate
```

---

# 45. WhatsApp APIs

Frontend should not directly call the FrontDesk API.

Instead:

```text
POST /api/whatsapp/connect
POST /api/whatsapp/verify
POST /api/whatsapp/test
PUT  /api/whatsapp/settings
```

The backend communicates with FrontDesk.

---

# 46. API Security

Every protected API endpoint must:

1. Identify the user
2. Verify authentication
3. Verify ownership of requested data
4. Validate input
5. Perform the operation

For example:

A user must NOT be able to request:

```text
GET /api/tasks/OTHER_USERS_TASK_ID
```

and receive another user's task.

---

# 47. Server-Side Validation

V1 will use simple validation.

Examples:

### Task title

```text
Required
String
Minimum length: 1
Maximum length: reasonable limit
```

### Priority

Must be:

```text
low
medium
high
urgent
```

### Status

Must be:

```text
pending
in_progress
completed
cancelled
```

### IDs

Must be valid MongoDB ObjectIds where applicable.

Validation will initially be implemented using normal JavaScript checks.

A validation library can be introduced later if the API becomes complex.

---

# 48. Error Handling

The API should use consistent responses.

Success:

```json
{
    "success": true,
    "data": {}
}
```

Error:

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Task title is required"
    }
}
```

Common error codes:

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
CONFLICT
SERVER_ERROR
```

---

# 49. Frontend API Layer

All API requests should go through:

```text
public/js/api.js
```

Example concept:

```text
api.get()
api.post()
api.put()
api.delete()
```

This prevents every frontend page from implementing HTTP logic separately.

---

# 50. Frontend Component Strategy

Even without React, reusable UI components should be created.

Examples:

```text
TaskCard
Modal
Dropdown
Sidebar
Toast
DatePicker
TaskForm
ProjectSelector
TagSelector
```

Vanilla JavaScript can create reusable components without requiring a framework.

---

# 51. Design System

Taskora should use a consistent design system.

### Primary

```text
#6366F1
```

### Dark Primary

```text
#4F46E5
```

### Background

```text
#F8FAFC
```

### Main Text

```text
#0F172A
```

### Success

```text
#22C55E
```

### Warning

```text
#F59E0B
```

### Danger

```text
#EF4444
```

---

# 52. Theme

Support:

```text
Light
Dark
System
```

The selected preference should be stored for the user.

---

# 53. Responsive Design

Taskora must work on:

```text
Desktop
Laptop
Tablet
Mobile browser
```

The mobile layout should not simply shrink the desktop interface.

It should provide a simplified navigation experience.

---

# 54. Security Requirements

Implement:

* Password hashing
* HTTP-only authentication cookies
* HTTPS
* Input validation
* Authorization checks
* Rate limiting where appropriate
* Secure headers
* CORS configuration
* MongoDB access restrictions
* Environment variables for secrets
* No API secrets in frontend code

Never expose:

```text
MongoDB credentials
JWT/session secrets
FrontDesk API keys
```

to the browser.

---

# 55. Environment Configuration

Example:

```text
NODE_ENV=production

PORT=3000

MONGODB_URI=

SESSION_SECRET=

FRONTDESK_API_URL=
FRONTDESK_API_KEY=
FRONTDESK_AGENT_ID=
```

Use `.env` locally.

Never commit `.env` to GitHub.

---

# 56. Logging

The backend should log:

* Server startup
* Database connection
* Authentication errors
* API errors
* Scheduler activity
* WhatsApp notification results
* Unexpected errors

Do NOT log:

* Passwords
* API keys
* Authentication secrets
* Sensitive user information

---

# 57. Scheduler Architecture

The scheduler should be independent from normal HTTP request handling.

Conceptually:

```text
server.js
   │
   ├── Express API
   │
   └── Scheduler
          │
          ├── Reminder Worker
          │
          └── Recurring Task Worker
```

---

# 58. Reminder Worker

Pseudo-flow:

```text
START
 ↓
Find pending reminders
 ↓
For each reminder
 ↓
Check user notification settings
 ↓
Check task still exists
 ↓
Check task is not cancelled
 ↓
Mark as processing
 ↓
Send through FrontDesk
 ↓
Success?
 ├── YES → sent
 └── NO  → failed
```

---

# 59. Failed Notification Handling

If WhatsApp sending fails:

```text
status = failed
error = reason
```

The system can retry failed notifications a limited number of times.

Example:

```text
Attempt 1
   ↓
Failed
   ↓
Wait
   ↓
Attempt 2
   ↓
Failed
   ↓
Attempt 3
   ↓
Stop
```

Do not retry forever.

---

# 60. Timezone Handling

Timezones are important because reminders depend on local time.

Every user should have:

```text
timezone
```

Example:

```text
Asia/Colombo
```

The backend should store dates consistently and convert them according to the user's timezone when scheduling/displaying reminders.

---

# 61. Data Ownership

Every user-owned document must contain:

```text
userId
```

Example:

```text
Task
{
    _id,
    userId,
    ...
}
```

Every query must use the authenticated user's ID.

Correct:

```text
find({
    _id: taskId,
    userId: currentUserId
})
```

Not:

```text
find({
    _id: taskId
})
```

This is one of the most important security rules in the application.

---

# 62. MongoDB Indexes

Create indexes for frequently searched fields.

Potential indexes:

```text
users.email

tasks.userId
tasks.userId + status
tasks.userId + dueDate
tasks.userId + projectId

reminders.userId
reminders.status
reminders.reminderTime
```

Indexes should be added based on actual query patterns.

---

# 63. No Caching in V1

Taskora V1 will not use Redis or another caching system.

All normal data requests will use MongoDB.

Caching can be introduced later if performance requirements justify it.

---

# 64. No Docker

Taskora V1 will be deployed directly on the server.

Use:

```text
Node.js
PM2
Nginx
MongoDB
```

MongoDB can be:

* MongoDB Atlas
* A separate MongoDB server
* Another managed MongoDB provider

MongoDB Atlas is recommended if we want to avoid maintaining the database server ourselves.

---

# 65. Deployment Architecture

```text
Internet
   │
   ▼
Nginx
   │
   ▼
Taskora Node.js
   │
   ├── MongoDB
   │
   └── FrontDesk Agents API
```

PM2:

```text
PM2
 └── Taskora
      └── Node.js
```

---

# 66. Development Phases

## Phase 1 — Project Setup

Tasks:

* Create Git repository
* Initialize Node project
* Install Express
* Configure environment variables
* Create server
* Connect MongoDB
* Serve frontend
* Create basic folder structure

Deliverable:

```text
Running Taskora development server
```

---

# 67. Phase 2 — Authentication

Implement:

* User model
* Registration
* Login
* Logout
* Password hashing
* Authentication middleware
* User session
* Protected routes

Deliverable:

```text
Users can securely register and log in.
```

---

# 68. Phase 3 — Basic UI

Build:

* Taskora branding
* Login page
* Registration page
* Main layout
* Sidebar
* Header
* Responsive design
* Theme system

Deliverable:

```text
Functional Taskora interface
```

---

# 69. Phase 4 — Task Management

Implement:

* Create task
* Edit task
* Delete task
* Complete task
* Uncomplete task
* Task details
* Task cards
* Task modal/form

Deliverable:

```text
Complete basic task management.
```

---

# 70. Phase 5 — Projects

Implement:

* Create project
* Edit project
* Delete/archive project
* Assign task to project
* Project filtering

Deliverable:

```text
Users can organize tasks into projects.
```

---

# 71. Phase 6 — Priority, Tags and Filters

Implement:

* Priority
* Tags
* Search
* Filtering
* Sorting

Deliverable:

```text
Users can quickly find and organize tasks.
```

---

# 72. Phase 7 — Due Dates and Calendar

Implement:

* Due date
* Due time
* Today view
* Upcoming view
* Overdue view
* Calendar

Deliverable:

```text
Taskora becomes a scheduling tool.
```

---

# 73. Phase 8 — Reminders

Implement:

* Reminder creation
* Reminder editing
* Reminder deletion
* Reminder database model
* Scheduler
* Reminder worker
* Reminder status tracking

Deliverable:

```text
Taskora can detect when reminders are due.
```

---

# 74. Phase 9 — FrontDesk WhatsApp Integration

Implement:

* FrontDesk API client
* WhatsApp settings
* User WhatsApp number
* Notification preference
* Test message
* Reminder message
* Notification logging
* Failed notification handling
* Retry mechanism

Deliverable:

```text
Taskora can send task reminders through WhatsApp.
```

---

# 75. Phase 10 — Recurring Tasks

Implement:

* Daily recurrence
* Weekly recurrence
* Monthly recurrence
* Recurrence configuration
* Next occurrence calculation
* Recurring worker

Deliverable:

```text
Taskora automatically handles recurring tasks.
```

---

# 76. Phase 11 — Dashboard

Implement:

* Today's task count
* Completed count
* Overdue count
* Upcoming count
* Completion percentage
* Recently completed tasks

Deliverable:

```text
Useful productivity overview.
```

---

# 77. Phase 12 — Settings

Implement:

* Profile
* Password change
* Theme
* Timezone
* WhatsApp settings
* Default reminder
* Notification preferences

---

# 78. Phase 13 — Security Hardening

Review:

* Authentication
* Authorization
* Input validation
* MongoDB queries
* Cookies
* CORS
* Rate limiting
* HTTP headers
* Environment secrets
* API access
* User data isolation

---

# 79. Phase 14 — Testing

Test:

### Authentication

* Register
* Login
* Logout
* Wrong password
* Duplicate email
* Unauthorized requests

### Tasks

* Create
* Edit
* Delete
* Complete
* Subtasks
* Invalid data

### Projects

* Create
* Edit
* Delete
* Task assignment

### Reminders

* Create
* Edit
* Delete
* Trigger
* Duplicate prevention

### WhatsApp

* Successful notification
* Invalid configuration
* API failure
* Retry
* Disabled notifications

### UI

* Desktop
* Tablet
* Mobile
* Dark mode
* Light mode

---

# 80. Performance Testing

Initially keep this simple.

Measure:

* API response times
* MongoDB query times
* Dashboard loading
* Task list loading
* Scheduler execution time

Do not introduce caching unless actual performance problems appear.

---

# 81. Production Deployment

Steps:

```text
Build/finalize application
        ↓
Configure production .env
        ↓
Configure MongoDB
        ↓
Upload code to VPS
        ↓
npm install
        ↓
Start with PM2
        ↓
Configure Nginx
        ↓
Configure domain
        ↓
Enable HTTPS
        ↓
Test production
```

---

# 82. PM2

Run Taskora using PM2.

Example concept:

```text
pm2 start server/server.js --name taskora
```

Configure automatic restart.

Use PM2 logs to monitor the application.

---

# 83. Nginx

Nginx should:

* Receive HTTPS requests
* Forward requests to Node.js
* Serve as reverse proxy
* Handle the domain
* Provide HTTPS

Architecture:

```text
https://taskora.example
        ↓
      Nginx
        ↓
localhost:3000
        ↓
Taskora
```

---

# 84. Backup Strategy

MongoDB data must be backed up.

V1 should have:

* Regular database backups
* Backup retention
* Ability to restore data

If MongoDB Atlas is used, use its available backup functionality where appropriate.

---

# 85. Git Strategy

Recommended branches:

```text
main
develop
feature/*
```

Example:

```text
feature/authentication
feature/task-management
feature/whatsapp-notifications
```

Commit frequently.

Use meaningful commit messages:

```text
feat: add task creation API
feat: implement WhatsApp reminder worker
fix: prevent duplicate reminders
style: improve task card UI
```

---

# 86. API Documentation

Maintain an API document containing:

```text
Endpoint
Method
Authentication
Request body
Response
Errors
```

Example:

```text
POST /api/tasks

Authentication:
Required

Body:
{
    "title": "Complete assignment",
    "priority": "high"
}

Response:
{
    "success": true,
    "data": {...}
}
```

---

# 87. V1 Feature Boundary

The following features are explicitly OUTSIDE V1:

```text
AI assistant
AI task creation
AI prioritization
AI recommendations

Team collaboration
Shared projects
Comments
Real-time collaboration

Email notifications
SMS notifications
Browser push notifications

Complex automation
Workflow engine

Third-party calendar synchronization
Google Calendar integration

Advanced analytics
Time tracking
Pomodoro

Native mobile application
Desktop application
```

These can be considered after V1 is stable.

---

# 88. Future Expansion

The architecture should allow future modules:

```text
Taskora
│
├── Task Management
├── Projects
├── Calendar
├── Reminders
├── WhatsApp
│
├── Future:
│   ├── AI
│   ├── Collaboration
│   ├── Email
│   ├── Google Calendar
│   ├── Mobile App
│   └── Automation
```

The important rule is:

**Do not implement future features now.**

Only make today's architecture flexible enough to support them.

---

# 89. Recommended Development Order

The actual implementation order should be:

```text
01. Project setup
02. MongoDB connection
03. Backend structure
04. Authentication
05. Base frontend layout
06. Task CRUD
07. Projects
08. Subtasks
09. Priority
10. Tags
11. Search
12. Filters
13. Sorting
14. Due dates
15. Calendar
16. Reminders
17. Scheduler
18. FrontDesk integration
19. WhatsApp notifications
20. Recurring tasks
21. Dashboard
22. Settings
23. Security hardening
24. Testing
25. Production deployment
```

---

# 90. Definition of Done for V1

Taskora V1 is considered complete when a new user can:

```text
Register
   ↓
Login
   ↓
Create a project
   ↓
Create a task
   ↓
Set priority
   ↓
Set due date/time
   ↓
Set WhatsApp reminder
   ↓
Close the website
   ↓
Reminder becomes due
   ↓
Receive WhatsApp message
   ↓
Open Taskora
   ↓
Mark task complete
   ↓
See updated dashboard
```

The complete V1 system should be:

* Secure
* Responsive
* Reliable
* Easy to maintain
* Deployable on a VPS
* Independent of AI
* Independent of Docker
* Independent of Redis/caching infrastructure
* Integrated with FrontDesk for WhatsApp notifications
* Ready for future expansion

---

# 91. Final V1 Architecture

```text
                         ┌──────────────────────┐
                         │       USER           │
                         │   Desktop / Mobile   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │       NGINX          │
                         │    HTTPS / Proxy     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │       TASKORA SERVER         │
                    │                              │
                    │      Node.js + Express       │
                    │                              │
                    │ ┌────────┐ ┌──────────────┐ │
                    │ │ REST   │ │  Scheduler   │ │
                    │ │  API   │ │              │ │
                    │ └───┬────┘ └──────┬───────┘ │
                    │     │              │         │
                    └─────┼──────────────┼─────────┘
                          │              │
                          ▼              ▼
                   ┌────────────┐  ┌───────────────┐
                   │  MongoDB   │  │   FrontDesk   │
                   │            │  │  Agents API   │
                   └────────────┘  └───────┬───────┘
                                            │
                                            ▼
                                         WhatsApp
                                            │
                                            ▼
                                      ┌─────────────┐
                                      │    USER     │
                                      └─────────────┘
```

## Final Technology Decision

```text
Frontend:
HTML + CSS + Vanilla JavaScript

Backend:
Node.js + Express.js

Database:
MongoDB

Authentication:
HTTP-only cookies + secure password hashing

Notifications:
FrontDesk Agents API → WhatsApp

Scheduler:
Node.js scheduler

Validation:
Server-side JavaScript validation

Caching:
None in V1

Containerization:
None

Deployment:
VPS + PM2 + Nginx

Version Control:
Git + GitHub
```

## Core Development Principle

**Build Taskora V1 as a clean, modular monolithic application.**

Do not split it into microservices.

Do not add AI.

Do not add Redis unless needed.

Do not add Docker.

Do not add a frontend framework.

Build the useful product first, validate that people actually want to use it, and introduce additional infrastructure only when the product's requirements justify it.
