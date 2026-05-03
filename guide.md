# Pulse 23 REST API — Complete Developer Guide

A comprehensive REST API for the Pulse 23 social feed. This document covers
every route, request shape, response shape, authentication mechanism,
database model, error contract, and end-to-end workflow you will need to
build a client against the API.

> **Base URL**
>
> ```
> https://mogvcutbtgknnwhklsiv.supabase.co/functions/v1/rest
> ```
>
> Anywhere this guide writes `/rest/...` you should expand it to the full
> URL above. Example: `/rest/posts` → `https://mogvcutbtgknnwhklsiv.supabase.co/functions/v1/rest/posts`.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quickstart](#2-quickstart)
3. [Authentication](#3-authentication)
4. [How API Keys Work](#4-how-api-keys-work)
5. [Response Format](#5-response-format)
6. [Error Handling](#6-error-handling)
7. [Rate Limits & Caching](#7-rate-limits--caching)
8. [Full Route Reference](#8-full-route-reference)
   - [Auth](#81-auth)
   - [Posts](#82-posts)
   - [Likes](#83-likes)
   - [Comments](#84-comments)
   - [Shares](#85-shares)
   - [Users](#86-users)
   - [Moderation](#87-moderation)
9. [Database Schema](#9-database-schema)
10. [Example Workflows](#10-example-workflows)
11. [SDK-Style Helpers](#11-sdk-style-helpers)
12. [FAQ](#12-faq)

---

## 1. Overview

The Pulse 23 REST API exposes the full social feed (posts, likes, comments,
shares, users, moderation) under a single namespace: **`/rest`**. It is the
*only* HTTP surface intended for third-party integration — no other
endpoints are part of the public contract.

### Design principles

- **One namespace.** Everything lives under `/rest`.
- **Resource-oriented.** URLs identify resources; verbs come from HTTP.
- **JSON in, JSON out.** Always.
- **Bearer tokens.** API keys are passed via `Authorization: Bearer <token>`.
- **Public reads, authenticated writes.** GET requests on posts, comments,
  likes, shares and user profiles are public. Anything that mutates state
  requires a token.
- **Moderation is privileged.** Moderation endpoints additionally require
  the caller to have moderator status in the database.

### Supported methods

`GET`, `POST`, `PATCH`, `PUT`, `DELETE`, plus `OPTIONS` for CORS preflight.

### Content types

All request bodies must be `application/json`. All responses are
`application/json; charset=utf-8`.

---

## 2. Quickstart

```bash
# 1. Get a token
curl -X POST https://mogvcutbtgknnwhklsiv.supabase.co/functions/v1/rest/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"hunter2"}'

# {"status":"success","data":{"token":"p23_abcdef...","user":{...}}}

# 2. Use it
TOKEN=p23_abcdef...

curl https://mogvcutbtgknnwhklsiv.supabase.co/functions/v1/rest/posts \
  -H "Authorization: Bearer $TOKEN"

# 3. Create a post
curl -X POST https://mogvcutbtgknnwhklsiv.supabase.co/functions/v1/rest/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello, Pulse 23!"}'
```

---

## 3. Authentication

Pulse 23 uses **Bearer token authentication** with API keys that you
generate from your username + password.

### Headers

```
Authorization: Bearer p23_<hex>
Content-Type: application/json
```

- The token is a 256-bit random value, hex-encoded, prefixed with `p23_`.
- It is **shown only once** at creation time. If lost, revoke it and
  generate a new one.
- Tokens never travel in URLs or query parameters.

### Public vs protected routes

| Method  | Path                         | Auth required? |
|---------|------------------------------|----------------|
| GET     | `/posts`                     | No             |
| GET     | `/posts/:id`                 | No             |
| GET     | `/posts/:id/likes`           | No             |
| GET     | `/posts/:id/comments`        | No             |
| GET     | `/posts/:id/shares`          | No             |
| GET     | `/posts/:id/stats`           | No             |
| GET     | `/users`, `/users/:id`       | No             |
| POST    | `/auth/login`                | No             |
| Any     | `/auth/me`, `/auth/keys/...` | Yes            |
| POST/PATCH/DELETE | `/posts/...`        | Yes            |
| POST/DELETE | `/posts/:id/likes`       | Yes            |
| POST    | `/posts/:id/comments`        | Yes            |
| PATCH/DELETE | `/comments/:id`         | Yes            |
| POST    | `/posts/:id/shares`          | Yes            |
| Any     | `/moderation/*`              | Yes + moderator role |

### Authorization vs authentication

- **Authentication** = "is this a valid token?" — checked by hashing the
  token and looking it up in the `api_keys` table.
- **Authorization** = "is this user allowed to do this?" — checked by
  resource ownership (`user_id` match) or moderator status.

---

## 4. How API Keys Work

### Generation

`POST /rest/auth/login` accepts a username + password, verifies them
against the auth backend, and on success:

1. Generates a cryptographically random 32-byte token.
2. Hashes it with SHA-256.
3. Stores the **hash only** (never the plaintext) in the `api_keys` table.
4. Returns the plaintext token to you exactly once.

### Verification (per request)

When the API receives `Authorization: Bearer <token>`:

1. The token is SHA-256 hashed.
2. The hash is looked up in `api_keys`.
3. If found and not revoked, the request is authenticated as the row's
   `user_id`. The `last_used_at` timestamp is bumped.
4. If revoked or missing, the request is rejected with `401 unauthorized`.

### Revocation

`DELETE /rest/auth/keys/:id` sets `revoked_at = now()`. The key still
exists for audit purposes but no longer authenticates anything.

### Listing

`GET /rest/auth/keys` returns the list of keys for the authenticated user
**without** the plaintext token (which is unrecoverable by design).

### Best practices

- Treat tokens like passwords. Never commit them.
- Use one token per integration / device — easier to rotate.
- Set a descriptive `name` when calling `/auth/login` (e.g.,
  `"github-actions"`).
- Rotate periodically.

---

## 5. Response Format

### Success

```json
{
  "status": "success",
  "data": { /* payload */ }
}
```

`data` may be an object, an array, or a primitive depending on the route.

### Error

```json
{
  "status": "error",
  "error": {
    "message": "human-readable description",
    "code": "machine-readable-code-or-null"
  }
}
```

The HTTP status code carries the same semantics as the body (e.g., a 404
will always pair with an error body).

---

## 6. Error Handling

| HTTP | When                                        | Example `code`           |
|------|---------------------------------------------|--------------------------|
| 400  | Validation error / bad request              | `null`                   |
| 401  | Missing or invalid token                    | `null`                   |
| 403  | Authenticated but not allowed               | `null`                   |
| 404  | Resource or route does not exist            | `not_found`              |
| 409  | Conflict (e.g., duplicate like)             | `null`                   |
| 500  | Server error                                | `internal`               |

### Validation rules

- Post content: required, ≤ 5000 characters.
- Comment content: required, ≤ 2000 characters.
- All UUIDs must be valid v4.
- `limit` query param: 1–100. Default 20.
- `offset` query param: ≥ 0. Default 0.

### Idempotency notes

- Liking a post twice is a no-op (returns success without double-counting).
- Unliking a post that wasn't liked is a no-op.
- Sharing a post is **not** deduplicated (each share creates a row).

---

## 7. Rate Limits & Caching

The function is deployed on Supabase Edge Functions, which apply the
platform's default rate limits. The API does not currently impose
application-level rate limits, but you should:

- Avoid polling more than once every 5 seconds per endpoint.
- Use `limit` and `offset` to paginate; don't try to fetch the whole feed
  at once.
- Cache `GET /users/:id` responses on the client for at least 60 seconds.

---

## 8. Full Route Reference

The base for every route is `/rest`. All bodies are JSON.

### 8.1 Auth

#### `POST /auth/login`

Generate a new API key.

**Body**

```json
{
  "username": "alice",
  "password": "hunter2",
  "name": "my laptop"        // optional, free-form label
}
```

**200**

```json
{
  "status": "success",
  "data": {
    "token": "p23_2f1e...",
    "key_id": "8e1b...",
    "user": { "id": "uuid", "username": "alice" },
    "message": "Store this token securely — it is shown only once."
  }
}
```

**401**: invalid credentials.

#### `GET /auth/me`

Return the authenticated user's profile + role flags.

**200**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "username": "alice",
    "display_name": "Alice",
    "avatar_url": null,
    "is_moderator": false,
    "is_admin": false
  }
}
```

#### `GET /auth/keys`

List your active and revoked keys (plaintext tokens are *never* returned).

```json
{
  "status": "success",
  "data": [
    {
      "id": "8e1b...",
      "name": "my laptop",
      "created_at": "2026-05-03T20:00:00Z",
      "last_used_at": "2026-05-03T21:30:00Z",
      "revoked_at": null
    }
  ]
}
```

#### `DELETE /auth/keys/:id`

Revoke a key.

```json
{ "status": "success", "data": { "revoked": true } }
```

---

### 8.2 Posts

#### `GET /posts`

Public. List the latest non-flagged posts.

**Query**

| Param    | Type   | Default | Notes              |
|----------|--------|---------|--------------------|
| `limit`  | int    | 20      | 1–100              |
| `offset` | int    | 0       | for pagination     |
| `user_id`| uuid   | —       | filter by author   |

**200**

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "content": "Hello world",
      "image_url": null,
      "likes_count": 3,
      "comments_count": 1,
      "shares_count": 0,
      "flagged": false,
      "created_at": "2026-05-03T20:00:00Z"
    }
  ]
}
```

#### `POST /posts` *(auth)*

```json
{ "content": "Hello world", "image_url": null }
```

**201**: returns the created post row.

#### `GET /posts/:id`

Returns a single post including its `flagged` state.

#### `PATCH /posts/:id` *(auth)*

Edit your own post (or any post if you're a moderator).

```json
{ "content": "Edited content" }
```

#### `DELETE /posts/:id` *(auth)*

Delete your own post (or any post if you're a moderator).

#### `GET /posts/:id/stats`

```json
{
  "status": "success",
  "data": {
    "likes_count": 12,
    "comments_count": 3,
    "shares_count": 1
  }
}
```

---

### 8.3 Likes

#### `GET /posts/:id/likes`

Public list of likers (newest first).

#### `POST /posts/:id/likes` *(auth)*

Like the post (idempotent).

#### `DELETE /posts/:id/likes` *(auth)*

Remove your like.

---

### 8.4 Comments

#### `GET /posts/:id/comments`

Public list of non-flagged comments, oldest first.

#### `POST /posts/:id/comments` *(auth)*

```json
{ "content": "Nice post!" }
```

#### `PATCH /comments/:id` *(auth)*

Edit your own comment (or any if moderator).

#### `DELETE /comments/:id` *(auth)*

Delete your own comment (or any if moderator). Decrements the post's
`comments_count`.

---

### 8.5 Shares

#### `GET /posts/:id/shares`

Public list of share events, newest first.

#### `POST /posts/:id/shares` *(auth)*

Records a share (multiple shares per user are allowed).

---

### 8.6 Users

#### `GET /users`

Public list (paginated via `limit`).

#### `GET /users/:idOrUsername`

Lookup by UUID **or** by username.

```json
{
  "id": "uuid",
  "username": "alice",
  "display_name": "Alice",
  "avatar_url": null,
  "bio": "Hi.",
  "pulse_count": 7,
  "created_at": "2026-04-01T00:00:00Z"
}
```

---

### 8.7 Moderation

All moderation routes require:

1. A valid Bearer token, **and**
2. The authenticated user has either:
   - the `pulse23moderation` beta code redeemed, or
   - admin status (username `senwot`).

Otherwise the route returns `403 forbidden`.

#### `POST /moderation/flag/post/:id`

Hide a post from public listings (`flagged = true`).

#### `POST /moderation/unflag/post/:id`

Restore a post.

#### `POST /moderation/flag/comment/:id`

Hide a comment from public listings.

#### `DELETE /moderation/remove/post/:id`

Permanently delete a post.

#### `POST /moderation/ban`

```json
{ "user_id": "uuid", "reason": "spam" }
```

Inserts a row into the `bans` table. The user can no longer post or
message until the ban is lifted.

#### `GET /moderation/reports`

List user reports (`user_reports` table) for review.

---

## 9. Database Schema

The API operates on these Postgres tables (RLS-enforced for the SDK; the
REST function uses the service role internally and re-enforces ownership
checks in code).

### `profiles`

| Column           | Type        | Notes                          |
|------------------|-------------|--------------------------------|
| `id`             | uuid (PK)   | Matches `auth.users.id`        |
| `username`       | text        | Unique handle                  |
| `display_name`   | text        |                                |
| `avatar_url`     | text        |                                |
| `bio`            | text        |                                |
| `pulse_count`    | int         | Cached counter                 |
| `is_verified`    | bool        |                                |
| `created_at`     | timestamptz |                                |

### `posts`

| Column           | Type        | Notes                          |
|------------------|-------------|--------------------------------|
| `id`             | uuid (PK)   |                                |
| `user_id`        | uuid        | Author                         |
| `content`        | text        | ≤ 5000 chars                   |
| `image_url`      | text        | nullable                       |
| `likes_count`    | int         | Maintained by API              |
| `comments_count` | int         | Maintained by API              |
| `shares_count`   | int         | Maintained by API              |
| `flagged`        | bool        | Hidden from public reads       |
| `created_at`     | timestamptz |                                |

### `likes`

| Column     | Type      | Notes                |
|------------|-----------|----------------------|
| `id`       | uuid (PK) |                      |
| `post_id`  | uuid      |                      |
| `user_id`  | uuid      |                      |
| `created_at` | timestamptz |                  |

### `comments`

| Column       | Type      | Notes              |
|--------------|-----------|--------------------|
| `id`         | uuid (PK) |                    |
| `post_id`    | uuid      |                    |
| `user_id`    | uuid      |                    |
| `content`    | text      | ≤ 2000 chars       |
| `flagged`    | bool      |                    |
| `created_at` | timestamptz |                  |

### `shares`

| Column       | Type      | Notes              |
|--------------|-----------|--------------------|
| `id`         | uuid (PK) |                    |
| `post_id`    | uuid      |                    |
| `user_id`    | uuid      |                    |
| `created_at` | timestamptz |                  |

### `api_keys`

| Column         | Type        | Notes                         |
|----------------|-------------|-------------------------------|
| `id`           | uuid (PK)   |                               |
| `user_id`      | uuid        | Owner                         |
| `token_hash`   | text        | SHA-256 of plaintext, unique  |
| `name`         | text        | Human label                   |
| `created_at`   | timestamptz |                               |
| `last_used_at` | timestamptz | Updated on each request       |
| `revoked_at`   | timestamptz | Null = active                 |

### `bans`

| Column        | Type        | Notes                 |
|---------------|-------------|-----------------------|
| `id`          | uuid (PK)   |                       |
| `user_id`     | uuid        | Banned user           |
| `reason`      | text        |                       |
| `banned_by`   | uuid        | Moderator             |
| `created_at`  | timestamptz |                       |
| `unbanned_at` | timestamptz | Null = currently banned |

### `user_reports`

| Column             | Type        | Notes                              |
|--------------------|-------------|------------------------------------|
| `id`               | uuid (PK)   |                                    |
| `reporter_id`      | uuid        |                                    |
| `reported_user_id` | uuid        |                                    |
| `reason`           | text        |                                    |
| `status`           | text        | `pending` / `reviewed` / `dismissed` |
| `created_at`       | timestamptz |                                    |

---

## 10. Example Workflows

### 10.1 Create post → like → comment → fetch feed

```bash
TOKEN=p23_...

# 1. Create a post
POST_ID=$(curl -s -X POST $API/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"My first API post!"}' | jq -r '.data.id')

# 2. Like it
curl -X POST $API/posts/$POST_ID/likes \
  -H "Authorization: Bearer $TOKEN"

# 3. Comment
curl -X POST $API/posts/$POST_ID/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"hello, self"}'

# 4. Fetch the feed
curl $API/posts?limit=10
```

### 10.2 Build an engagement dashboard

```js
const res = await fetch(`${API}/posts/${id}/stats`);
const { data } = await res.json();
console.log(`👍 ${data.likes_count}  💬 ${data.comments_count}  🔁 ${data.shares_count}`);
```

### 10.3 Moderate a flagged post

```bash
# Flag
curl -X POST $API/moderation/flag/post/$POST_ID \
  -H "Authorization: Bearer $MOD_TOKEN"

# Or remove permanently
curl -X DELETE $API/moderation/remove/post/$POST_ID \
  -H "Authorization: Bearer $MOD_TOKEN"
```

### 10.4 Rotate an API key

```bash
# 1. Mint a new one
NEW=$(curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"hunter2","name":"rotated"}' | jq -r '.data.token')

# 2. Verify it works
curl $API/auth/me -H "Authorization: Bearer $NEW"

# 3. Revoke the old one
curl -X DELETE $API/auth/keys/$OLD_KEY_ID \
  -H "Authorization: Bearer $NEW"
```

---

## 11. SDK-Style Helpers

A tiny TypeScript wrapper:

```ts
const API = "https://mogvcutbtgknnwhklsiv.supabase.co/functions/v1/rest";

export class PulseClient {
  constructor(private token?: string) {}

  private async req(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> ?? {}),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${API}${path}`, { ...init, headers });
    const json = await res.json();
    if (json.status !== "success") throw new Error(json.error?.message ?? "error");
    return json.data;
  }

  login(username: string, password: string) {
    return this.req("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }
  feed(limit = 20) { return this.req(`/posts?limit=${limit}`); }
  post(content: string) {
    return this.req("/posts", { method: "POST", body: JSON.stringify({ content }) });
  }
  like(id: string) { return this.req(`/posts/${id}/likes`, { method: "POST" }); }
  unlike(id: string) { return this.req(`/posts/${id}/likes`, { method: "DELETE" }); }
  comment(id: string, content: string) {
    return this.req(`/posts/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }
  share(id: string) { return this.req(`/posts/${id}/shares`, { method: "POST" }); }
}
```

---

## 12. FAQ

**Why isn't there a `/users/me` endpoint?**
Use `GET /auth/me` — it returns the same profile plus role flags.

**Can I sign up via the API?**
No. Account creation is performed via the Pulse 23 web client. Once you
have an account, the API gives you full programmatic access.

**Are tokens reusable across devices?**
Yes, but you should mint one token per device for easier rotation.

**Can I list all comments by a user?**
Not directly — fetch their posts and aggregate, or query individual posts.
A dedicated endpoint may be added in a future version.

**What happens to my posts if I'm banned?**
Your posts remain in the database; moderators may flag or remove them.
You cannot create new posts, comments, or shares while banned.

**How do I delete my account?**
Account deletion lives in the Pulse 23 client (`Settings → Delete account`)
and is **not** available through the REST API.

---

*Last updated: 2026-05-03*
