# ModParks API Documentation (v1)

This document describes the public REST API endpoints available in ModParks.

All API endpoints are prefixed with `/api/v1`.

## Authentication

Public endpoints for reading data (such as getting a project or fetching versions) **do not** require authentication and can be accessed without an API key.

However, certain private or rate-limited endpoints may require an API key to be passed in the `Authorization` header as a Bearer token.

- **Header:** `Authorization: Bearer <your_api_key>`
- **Example:** `Authorization: Bearer mp_a2d0example`

If a protected endpoint receives a request without a valid header, it will return a `401 Unauthorized` error:
```json
{
  "error": "Missing or invalid Authorization header"
}
```

---

## Projects API

### 1. Get Project Details
Fetches public details of a specific project by its slug.

- **URL:** `/api/v1/projects/[slug]`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "id": "12345",
    "slug": "sample-mod",
    "name": "Sample Mod",
    "description": "A sample mod for Minecraft",
    "iconUrl": "https://example.com/icon.png",
    "type": "mod",
    "license": "MIT",
    "sourceUrl": "https://github.com/...",
    "downloads": {
      "total": 1500,
      "native": 500,
      "modrinth": 800,
      "curseforge": 200
    },
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-06-01T00:00:00Z",
    "author": {
      "username": "Pitan76",
      "displayName": "Pitan",
      "avatarUrl": "https://github.com/..."
    },
    "categories": ["Utility", "Magic"],
    "tags": ["fabric", "forge"]
  }
  ```
- **Error (404 Not Found):** If the project does not exist or is private.

---

## Projects List API

### 1. List Projects
Fetches a list of public projects.

- **URL:** `/api/v1/projects`
- **Method:** `GET`
- **Query Parameters:**
  - `limit` (optional): Default 20, Max 80.
  - `offset` (optional): Default 0.
- **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "12345",
      "slug": "sample-mod",
      "name": "Sample Mod",
      "iconUrl": "https://example.com/icon.png",
      "type": "mod",
      "license": "MIT",
      "downloads": {
        "total": 1500,
        "native": 500,
        "modrinth": 800,
        "curseforge": 200
      },
      "createdAt": 1672531200000,
      "updatedAt": 1685587200000,
      "author": {
        "username": "Pitan76",
        "displayName": "Pitan",
        "avatarUrl": "https://github.com/..."
      },
      "categories": ["Utility","Magic"],
      "tags": ["fabric","forge"]
    }
  ],
  "meta": {
    "limit": 20,
    "offset": 0,
    "count": 1
  }
}
```
- **Error (400 Bad Request):** Invalid `limit`/`offset`.


## Versions API

### 1. Get Project Versions
Fetches all public versions of a specific project.

- **URL:** `/api/v1/projects/[slug]/versions`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "versions": [
      {
        "id": "abc-123",
        "versionNumber": "1.0.0",
        "mcVersions": ["1.20.1", "1.20.2"],
        "loaders": ["fabric", "forge"],
        "changelog": "Initial release",
        "fileUrl": "https://...",
        "fileName": "sample-mod-1.0.0.jar",
        "fileSize": 1024000,
        "downloads": 500,
        "createdAt": "2026-06-01T00:00:00Z"
      }
    ]
  }
  ```

---

## Users API

### 1. Get User Profile
Fetches public profile information of a user.

- **URL:** `/api/v1/users/[username]`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "id": "user-123",
    "username": "Pitan76",
    "displayName": "Pitan",
    "avatarUrl": "https://github.com/...",
    "bio": "Minecraft Mod Developer",
    "createdAt": "2026-01-01T00:00:00Z"
  }
  ```
- **Error (404 Not Found):** If the user does not exist.

---

## Ideas API

### 1. List Ideas
Fetches recently posted ideas on the Idea Board.

- **URL:** `/api/v1/ideas`
- **Method:** `GET`
- **Query Parameters:**
  - `limit` (optional): Default 20, Max 80.
- **Response (200 OK):**
  ```json
  {
    "ideas": [
      {
        "id": "idea-1",
        "title": "We need a better minimap mod",
        "description": "It would be great if...",
        "author": {
          "username": "player1",
          "avatarUrl": "https://..."
        },
        "createdAt": "2026-06-01T00:00:00Z"
      }
    ]
  }
  ```

---

## Current User Profile API (Authenticated)

### 1. Get Logged-in User Profile
Fetches the profile settings of the currently authenticated user.

- **URL:** `/api/v1/profile`
- **Method:** `GET`
- **Headers:** Requires Authentication Cookie / Session.
- **Response (200 OK):**
  ```json
  {
    "id": "user-123",
    "username": "Pitan76",
    "displayName": "Pitan",
    "avatarUrl": "https://github.com/...",
    "bio": "Minecraft Mod Developer",
    "locale": "ja"
  }
  ```
- **Error (401 Unauthorized):** If not logged in.

---

## Integrations API (Authenticated)

### 1. Get Integration Settings
Fetches the current user's integration settings (API keys are masked).

- **URL:** `/api/v1/profile/integrations`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "hasModrinthKey": true,
    "hasCurseforgeKey": false
  }
  ```

### 2. Update Integration Settings
Updates Modrinth or CurseForge API keys.

- **URL:** `/api/v1/profile/integrations`
- **Method:** `PUT`
- **Body:**
  ```json
  {
    "modrinthApiKey": "mrp_xxxxxxxx",
    "curseforgeApiKey": "$2a$10$..."
  }
  ```
- **Response (200 OK)**

---

## Project Import & Sync API (Authenticated)

### 1. Import Project
Imports a project from Modrinth or CurseForge.

- **URL:** `/api/v1/projects/import`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "platform": "modrinth",
    "externalId": "A1b2C3d4"
  }
  ```
- **Response (201 Created):**
  Returns the imported project details including the new slug.

### 2. Sync Project
Synchronizes an imported project's details and downloads with the external platform.

- **URL:** `/api/v1/projects/[slug]/sync`
- **Method:** `POST`
- **Response (200 OK):**
  Returns the updated project details.

### 3. Update Project Settings
Updates project settings such as comment enablement and issue tracker URL.

- **URL:** `/api/v1/projects/[slug]/settings`
- **Method:** `PUT`
- **Body:**
  ```json
  {
    "commentsEnabled": true,
    "issueTrackerUrl": "https://github.com/...",
    "status": "public"
  }
  ```
- **Response (200 OK)**

---

## Project Comments API

### 1. Get Project Comments
Fetches comments for a project (if enabled).

- **URL:** `/api/v1/projects/[slug]/comments`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "comments": [
      {
        "id": "comment-1",
        "content": "Great mod!",
        "author": { "username": "player1", "avatarUrl": "..." },
        "createdAt": "2026-06-01T00:00:00Z"
      }
    ]
  }
  ```

### 2. Post Comment
Posts a new comment to a project.

- **URL:** `/api/v1/projects/[slug]/comments`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "content": "This is a new comment."
  }
  ```
- **Response (201 Created)**

### 3. Delete Comment
Deletes a specific comment (requires author or admin).

- **URL:** `/api/v1/projects/[slug]/comments/[commentId]`
- **Method:** `DELETE`
- **Response (200 OK)**

---

## User Follows API

### 1. Follow User
Follows a specific user.

- **URL:** `/api/v1/users/[username]/follow`
- **Method:** `POST`
- **Response (200 OK)**

### 2. Unfollow User
Unfollows a specific user.

- **URL:** `/api/v1/users/[username]/follow`
- **Method:** `DELETE`
- **Response (200 OK)**

### 3. Get Followers / Following
Fetches the list of followers or users being followed.

- **URL:** `/api/v1/users/[username]/followers` (or `/following`)
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "users": [
      { "username": "player1", "displayName": "Player One", "avatarUrl": "..." }
    ],
    "count": 1
  }
  ```

---

## Collections (Lists) API

### 1. Update Collection
Updates a collection's details (author only).

- **URL:** `/api/v1/collections/[id]`
- **Method:** `PUT`
- **Body:**
  ```json
  {
    "name": "My Favorites",
    "description": "Best mods ever",
    "visibility": "public",
    "iconUrl": "https://..."
  }
  ```
- **Response (200 OK)**

### 2. Delete Collection
Deletes a collection (author only).

- **URL:** `/api/v1/collections/[id]`
- **Method:** `DELETE`
- **Response (200 OK)**

### 3. Follow Collection
Follows another user's collection.

- **URL:** `/api/v1/collections/[id]/follow`
- **Method:** `POST`
- **Response (200 OK)**

### 4. Unfollow Collection
Unfollows a collection.

- **URL:** `/api/v1/collections/[id]/follow`
- **Method:** `DELETE`
- **Response (200 OK)**

