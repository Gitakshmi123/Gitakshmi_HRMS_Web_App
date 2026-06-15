# Face + GPS Attendance with Live Tracking

## What is included

- Face attendance marking through `POST /api/attendance/mark`
- Passive liveness validation using multi-frame blink/head movement checks
- GPS capture and structured attendance storage
- Background live location tracking every 10-20 seconds
- GPS spoof heuristics:
  - poor accuracy
  - sudden distance jumps
  - unrealistic speed
  - device binding mismatch
- Real-time admin stream over Socket.io
- Admin live map with:
  - 3D buildings
  - live employee markers
  - path history playback
  - online/offline state

## Backend schema

### `attendance`

Attendance records now store:

- `faceVerified`
- `gpsValidated`
- `gpsLocation`
- `checkInLocation`
- `checkOutLocation`
- `faceVerification`
- `tracking`
- `securityFlags`
- enriched `logs[]` with GPS/device/security metadata

### `live_tracking`

Every tracking ping stores:

- `tenant`
- `employee`
- `attendance`
- `session`
- `timestamp`
- `location`
- `geoPoint` (`2dsphere`)
- `battery`
- `network`
- `device`
- `source`
- `intervalSeconds`
- `security`

### `live_tracking_sessions`

Session-level state stores:

- `tenant`
- `employee`
- `attendance`
- `dateKey`
- `status`
- `online`
- `checkInTime`
- `checkOutTime`
- `lastHeartbeatAt`
- `startLocation`
- `lastLocation`
- `recommendedIntervalSec`
- `security`
- `device`

## API routes

### Attendance

- `POST /api/attendance/mark`
- `POST /api/attendance/face/verify`

Both now use the same secure face + GPS attendance flow.

### Tracking

- `POST /api/location/update`
- `GET /api/location/live`
- `GET /api/location/history/:userId`

## Real-time events

Admin dashboards receive:

- `tracking:connected`
- `tracking:location:update`
- `tracking:session:update`

## Required environment variables

### Server

- `FACE_EMBEDDING_KEY`
- `ATTENDANCE_TRACKING_MIN_INTERVAL_SEC=10`
- `ATTENDANCE_TRACKING_MAX_INTERVAL_SEC=20`
- `ATTENDANCE_MAX_GPS_ACCURACY=150`
- `ATTENDANCE_MAX_SPEED_KMH=180`
- `ATTENDANCE_MAX_DISTANCE_JUMP_METERS=1500`
- `ATTENDANCE_ONLINE_WINDOW_SEC=45`
- `ATTENDANCE_STRICT_DEVICE_BINDING=false`

Optional for local/dev:

- `ATTENDANCE_ALLOW_LIVENESS_BYPASS=true`

### Client

- `VITE_MAPBOX_ACCESS_TOKEN`
- `VITE_HRMS_API_ROOT`

## Setup

### 1. Install server dependency

Run inside `server/`:

```powershell
npm install
```

`socket.io` has been added to `server/package.json`.

### 2. Configure Mapbox

Add a valid Mapbox public token to the client env:

```env
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

Without this token, the live employee list still works, but the 3D map stays disabled.

### 3. Start the stack

Server:

```powershell
cd server
npm run dev
```

Client:

```powershell
cd client
npm run dev
```

## Frontend behavior

### Employee

- open face attendance
- grant camera + location
- complete liveness capture
- attendance is marked through `/attendance/mark`
- tracking starts automatically after check-in
- tracking stops automatically on:
  - check-out
  - logout

### Admin

- open Attendance module
- switch to `Live Tracking`
- select a user on the left
- inspect live position and route history

## Verification completed

- server syntax check:
  - `server/controllers/attendanceTracking.controller.js`
  - `server/services/locationSecurity.service.js`
  - `server/services/socket.service.js`
  - `server/routes/location.routes.js`
- server module load:
  - `require('./server/app')`
- targeted client lint:
  - `FaceAttendance.jsx`
  - `AttendanceLiveMap.jsx`
  - `locationTracking.service.js`
  - `AuthContext.jsx`
  - `AttendanceAdmin.jsx`
  - `runtimeAssets.js`

## Note

The full Vite production build is very heavy in this repository and timed out in this environment, so validation was done with targeted linting plus server syntax/module loading.
