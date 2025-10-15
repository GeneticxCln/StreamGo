# StreamGo Addon Protocol Specification

**Version:** 1.0.0  
**Last Updated:** 2025-01-15

## Overview

The StreamGo Addon Protocol is an HTTP-based protocol for integrating third-party content sources into StreamGo. It is inspired by Stremio's addon protocol and provides a standardized way for addons to provide catalogs, metadata, and streaming sources.

## Table of Contents

1. [Protocol Basics](#protocol-basics)
2. [Manifest Endpoint](#manifest-endpoint)
3. [Catalog Endpoint](#catalog-endpoint)
4. [Stream Endpoint](#stream-endpoint)
5. [Meta Endpoint](#meta-endpoint)
6. [Validation Rules](#validation-rules)
7. [Security Considerations](#security-considerations)
8. [Best Practices](#best-practices)
9. [Examples](#examples)

---

## Protocol Basics

### Base URL

All addons must be hosted at an HTTPS URL (HTTP allowed for development only). The base URL serves as the root for all addon endpoints.

**Example:** `https://example.com/addon`

### Required Endpoints

- `GET /manifest.json` - Addon manifest (required)
- `GET /catalog/{type}/{id}.json` - Catalog listings (optional)
- `GET /stream/{type}/{id}.json` - Stream sources (optional)
- `GET /meta/{type}/{id}.json` - Detailed metadata (optional)

### Content Type

All responses must use `Content-Type: application/json`

### HTTP Methods

Only `GET` requests are supported.

---

## Manifest Endpoint

### Endpoint

```
GET /manifest.json
```

### Purpose

Describes the addon's capabilities, supported media types, catalogs, and resources.

### Response Schema

```json
{
  "id": "string (required)",
  "name": "string (required)",
  "version": "string (required, semver)",
  "description": "string (required)",
  "types": ["movie", "series", "channel", "tv"],
  "catalogs": [
    {
      "type": "movie",
      "id": "popular",
      "name": "Popular Movies",
      "extra": [
        {
          "name": "genre",
          "isRequired": false,
          "options": ["Action", "Comedy", "Drama"],
          "optionsLimit": 1
        }
      ]
    }
  ],
  "resources": ["catalog", "stream", "meta", "subtitles"],
  "idPrefixes": ["tt", "tmdb:"],
  "behaviorHints": {
    "adult": false,
    "p2p": false
  }
}
```

### Field Descriptions

#### Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier (alphanumeric, hyphens, underscores, dots). Max 100 chars. |
| `name` | string | ✓ | Human-readable name. Max 200 chars. |
| `version` | string | ✓ | Semantic version (e.g., "1.0.0" or "1.0.0-beta") |
| `description` | string | ✓ | Addon description. Max 5000 chars. |
| `types` | array | ✓ | Supported media types: "movie", "series", "channel", "tv" |
| `catalogs` | array | ✓* | Catalog descriptors (*required if `catalog` resource is provided) |
| `resources` | array | ✓ | Provided resources: "catalog", "stream", "meta", "subtitles" |
| `idPrefixes` | array | ✗ | ID prefixes this addon can handle (e.g., ["tt", "tmdb:"]) |
| `behaviorHints` | object | ✗ | Behavioral hints for the addon |

#### Catalog Descriptor

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | ✓ | Media type: "movie", "series", "channel", "tv" |
| `id` | string | ✓ | Unique catalog identifier. URL-safe (alphanumeric, hyphens, underscores). Max 100 chars. |
| `name` | string | ✓ | Human-readable catalog name. Max 200 chars. |
| `extra` | array | ✗ | Extra parameters supported by this catalog |

#### Extra Field

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✓ | Parameter name (e.g., "genre", "skip", "search"). Max 50 chars. |
| `isRequired` | boolean | ✗ | Whether this parameter is required |
| `options` | array | ✗ | Predefined options. Max 100 options, each max 200 chars. |
| `optionsLimit` | number | ✗ | Maximum number of options that can be selected (1-100) |

#### Behavior Hints

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `adult` | boolean | false | Contains adult content |
| `p2p` | boolean | false | Uses peer-to-peer protocols |

### Validation Rules

1. **ID Format**: Must contain only alphanumeric characters, hyphens, underscores, and dots
2. **Version Format**: Must follow semantic versioning (minimum major.minor, optionally patch and pre-release)
3. **Resource Consistency**:
   - If `catalog` resource is declared, `catalogs` array must not be empty
   - If `catalog` resource is declared, `types` array must not be empty
   - Catalog `type` must exist in manifest `types` array
4. **Size Limits**:
   - Manifest max size: 100KB
   - ID max length: 100 characters
   - Name max length: 200 characters
   - Description max length: 5000 characters

---

## Catalog Endpoint

### Endpoint

```
GET /catalog/{type}/{id}.json[?extra=value&...]
```

### Parameters

- `{type}`: Media type ("movie", "series", "channel", "tv")
- `{id}`: Catalog ID from manifest
- Query parameters: Extra fields as defined in manifest

### Purpose

Returns a list of media items for a specific catalog.

### Response Schema

```json
{
  "metas": [
    {
      "id": "tt1234567",
      "type": "movie",
      "name": "Example Movie",
      "poster": "https://example.com/poster.jpg",
      "posterShape": "poster",
      "background": "https://example.com/bg.jpg",
      "logo": "https://example.com/logo.png",
      "description": "A great movie",
      "releaseInfo": "2024",
      "imdbRating": 8.5
    }
  ]
}
```

### Field Descriptions

#### Meta Preview

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✓ | Unique media identifier |
| `type` | string | ✓ | Media type: "movie", "series", "channel", "tv" |
| `name` | string | ✓ | Title of the media |
| `poster` | string | ✗ | Poster image URL |
| `posterShape` | string | ✗ | Poster aspect ratio: "poster" (2:3), "landscape" (16:9), "square" (1:1) |
| `background` | string | ✗ | Background image URL |
| `logo` | string | ✗ | Logo image URL (transparent PNG recommended) |
| `description` | string | ✗ | Short description |
| `releaseInfo` | string | ✗ | Release year or date |
| `imdbRating` | number | ✗ | IMDb rating (0-10) |

### Validation Rules

1. Max response size: 10MB
2. Max items per response: 1000 (automatically truncated)
3. All image URLs must be valid HTTP/HTTPS URLs

### Example Request

```
GET /catalog/movie/popular.json?genre=Action&skip=0
```

---

## Stream Endpoint

### Endpoint

```
GET /stream/{type}/{id}.json
```

### Parameters

- `{type}`: Media type ("movie", "series", "channel", "tv")
- `{id}`: Media ID (e.g., "tt1234567" or "tmdb:12345")

### Purpose

Returns available streaming sources for a specific media item.

### Response Schema

```json
{
  "streams": [
    {
      "url": "https://example.com/stream.m3u8",
      "title": "4K HDR",
      "name": "2160p",
      "description": "Cached • 4K • HDR • 5.1",
      "behaviorHints": {
        "notWebReady": false,
        "bingeGroup": "season-1",
        "countryWhitelist": ["US", "CA"]
      },
      "subtitles": [
        {
          "id": "en",
          "url": "https://example.com/subs/en.vtt",
          "lang": "eng"
        }
      ]
    }
  ]
}
```

### Field Descriptions

#### Stream

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✓ | Streaming URL (must be HTTP/HTTPS) |
| `title` | string | ✗ | Stream title |
| `name` | string | ✗ | Quality indicator (e.g., "1080p", "720p") |
| `description` | string | ✗ | Additional info (e.g., "Cached • 1080p • 5.1") |
| `behaviorHints` | object | ✗ | Stream behavior hints |
| `subtitles` | array | ✗ | Available subtitle tracks |

#### Stream Behavior Hints

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `notWebReady` | boolean | false | Stream cannot be played in browser |
| `bingeGroup` | string | null | Group ID for binge-watching (e.g., "season-1") |
| `countryWhitelist` | array | null | Country codes where stream is available |

#### Subtitle

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✓ | Subtitle track identifier |
| `url` | string | ✓ | Subtitle file URL (WebVTT or SRT) |
| `lang` | string | ✓ | ISO 639-2 language code |

### Validation Rules

1. Max response size: 10MB
2. Stream URLs must use HTTP or HTTPS protocols only
3. Stream URLs must have a valid hostname
4. Invalid streams are automatically filtered out

### Supported Stream Formats

- HLS (`.m3u8`)
- MPEG-DASH (`.mpd`)
- Direct video files (`.mp4`, `.mkv`, `.avi`, `.webm`)

---

## Meta Endpoint

### Endpoint

```
GET /meta/{type}/{id}.json
```

### Parameters

- `{type}`: Media type
- `{id}`: Media ID

### Purpose

Returns detailed metadata for a specific media item.

### Response Schema

```json
{
  "meta": {
    "id": "tt1234567",
    "type": "movie",
    "name": "Example Movie",
    "description": "Full description...",
    "releaseInfo": "2024-03-15",
    "runtime": "120 min",
    "genres": ["Action", "Thriller"],
    "director": ["John Director"],
    "cast": ["Actor One", "Actor Two"],
    "imdbRating": 8.5,
    "poster": "https://example.com/poster.jpg",
    "background": "https://example.com/bg.jpg",
    "logo": "https://example.com/logo.png",
    "trailers": [
      {
        "source": "youtube:ABC123",
        "type": "Trailer"
      }
    ]
  }
}
```

---

## Validation Rules

### General

1. All JSON responses must be valid JSON
2. Response sizes should not exceed 10MB
3. Timeout: Requests timeout after 5 seconds
4. Retry: Failed requests are retried up to 3 times with exponential backoff

### Manifest Validation

- ID: 1-100 characters, alphanumeric + hyphens/underscores/dots
- Name: 1-200 characters
- Description: 0-5000 characters
- Version: Valid semver (2-4 parts)
- At least one resource type must be declared
- Catalog resource requires catalogs array and types array
- Each catalog ID: 1-100 characters, URL-safe
- Each catalog name: 1-200 characters
- Extra field name: 1-50 characters
- Extra options: max 100, each max 200 characters
- ID prefixes: max 50 characters each

### URL Validation

- Only HTTP and HTTPS protocols allowed
- Must have valid hostname
- Image URLs should be direct links to images
- Stream URLs are validated before being returned to clients

---

## Security Considerations

### Input Validation

1. **URL Sanitization**: All URLs are validated and sanitized
2. **Size Limits**: Enforced on all responses
3. **Protocol Restrictions**: Only HTTP/HTTPS allowed
4. **Injection Prevention**: All query parameters are escaped

### HTTPS Requirement

- Production addons **must** use HTTPS
- HTTP is only allowed for local development
- Self-signed certificates are rejected

### Rate Limiting

Clients may implement rate limiting to prevent abuse:
- Recommended: 100 requests per minute per addon
- Burst: 10 concurrent requests

### Content Safety

1. Adult content must be declared in `behaviorHints.adult`
2. P2P streams must be declared in `behaviorHints.p2p`
3. Country restrictions should be honored via `countryWhitelist`

---

## Best Practices

### Performance

1. **Caching**: Implement server-side caching for expensive operations
2. **Pagination**: Use `skip` parameter for large catalogs
3. **Compression**: Enable gzip/brotli compression
4. **CDN**: Use CDN for static assets (posters, backgrounds)

### Reliability

1. **Error Handling**: Return appropriate HTTP status codes
2. **Timeouts**: Respond within 3 seconds (5 second hard limit)
3. **Fallbacks**: Provide default values for optional fields
4. **Monitoring**: Log errors and performance metrics

### User Experience

1. **Quality Indicators**: Use `name` field for quality labels ("1080p", "4K")
2. **Stream Info**: Provide descriptive `description` ("Cached • 1080p • 5.1")
3. **Images**: Provide high-quality poster and background images
4. **Metadata**: Include as much detail as available

### Content Organization

1. **Catalog Structure**: Create logical catalog divisions
2. **Search Support**: Implement `search` extra parameter
3. **Genre Filtering**: Support genre filtering where applicable
4. **Sorting**: Support sorting by popularity, date, rating

---

## Examples

### Example Manifest

```json
{
  "id": "org.example.movies",
  "name": "Example Movies",
  "version": "1.0.0",
  "description": "Free movies from various sources",
  "types": ["movie"],
  "catalogs": [
    {
      "type": "movie",
      "id": "popular",
      "name": "Popular Movies",
      "extra": [
        {
          "name": "genre",
          "options": ["Action", "Comedy", "Drama"]
        },
        {
          "name": "skip",
          "isRequired": false
        }
      ]
    }
  ],
  "resources": ["catalog", "stream"],
  "idPrefixes": ["tt"],
  "behaviorHints": {
    "adult": false,
    "p2p": false
  }
}
```

### Example Catalog Response

```json
{
  "metas": [
    {
      "id": "tt1234567",
      "type": "movie",
      "name": "The Great Adventure",
      "poster": "https://cdn.example.com/posters/1234567.jpg",
      "posterShape": "poster",
      "background": "https://cdn.example.com/backgrounds/1234567.jpg",
      "description": "An epic adventure story",
      "releaseInfo": "2024",
      "imdbRating": 8.5
    }
  ]
}
```

### Example Stream Response

```json
{
  "streams": [
    {
      "url": "https://cdn.example.com/stream/movie.m3u8",
      "title": "Full HD",
      "name": "1080p",
      "description": "Cached • 1080p • Stereo",
      "behaviorHints": {
        "notWebReady": false
      },
      "subtitles": [
        {
          "id": "en",
          "url": "https://cdn.example.com/subs/en.vtt",
          "lang": "eng"
        }
      ]
    },
    {
      "url": "https://cdn.example.com/stream/movie-4k.m3u8",
      "title": "4K Ultra HD",
      "name": "2160p",
      "description": "Cached • 4K • HDR • 5.1",
      "behaviorHints": {
        "notWebReady": false
      }
    }
  ]
}
```

---

## Error Handling

### HTTP Status Codes

- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Temporary unavailable

### Error Response

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found"
  }
}
```

---

## Version History

- **1.0.0** (2025-01-15): Initial specification
  - Manifest endpoint with comprehensive validation
  - Catalog endpoint with pagination support
  - Stream endpoint with quality indicators
  - Meta endpoint for detailed metadata
  - Security and validation rules
  - Health tracking integration

---

## References

- Stremio Addon SDK: https://github.com/Stremio/stremio-addon-sdk
- HLS Specification: https://datatracker.ietf.org/doc/html/rfc8216
- Semantic Versioning: https://semver.org/

---

**Copyright © 2025 StreamGo Project**  
Licensed under MIT License
