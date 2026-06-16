# ModParks API Documentation (v1)

This document describes the public REST API endpoints available in ModParks.

All API endpoints are prefixed with `/api/v1`.

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
    "downloads": 1500,
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
  - `limit` (optional): Default 20, Max 50.
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
