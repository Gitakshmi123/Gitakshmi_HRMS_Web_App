const EARTH_RADIUS_METERS = 6371000;

const toFiniteNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCapturedAt = (sample) => {
  const explicit = toFiniteNumber(sample?.capturedAt);
  if (explicit !== null) return explicit;

  const timestampValue = sample?.timestamp ? new Date(sample.timestamp).getTime() : NaN;
  if (Number.isFinite(timestampValue)) return timestampValue;

  return Date.now();
};

const roundCoordinate = (value) => Number(Number(value).toFixed(7));

const normalizeAccuracy = (sample, fallback = 9999) =>
  Math.max(1, toFiniteNumber(sample?.accuracy, fallback));

export const normalizeLocationSample = (sample = {}) => {
  const source = sample && typeof sample === 'object' ? sample : {};
  const lat = toFiniteNumber(source.lat);
  const lng = toFiniteNumber(source.lng);

  if (
    lat === null ||
    lng === null ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return {
    ...source,
    lat: roundCoordinate(lat),
    lng: roundCoordinate(lng),
    accuracy: toFiniteNumber(source.accuracy),
    speed: toFiniteNumber(source.speed),
    heading: toFiniteNumber(source.heading),
    altitude: toFiniteNumber(source.altitude),
    timestamp: source.timestamp || new Date().toISOString(),
    capturedAt: toCapturedAt(source)
  };
};

export const haversineDistanceMeters = (left, right) => {
  const pointA = normalizeLocationSample(left);
  const pointB = normalizeLocationSample(right);

  if (!pointA || !pointB) return 0;

  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const trimLocationSamples = (
  samples = [],
  { maxAgeMs = 15000, maxSamples = 6 } = {}
) => {
  const now = Date.now();

  return (Array.isArray(samples) ? samples : [])
    .map((sample) => normalizeLocationSample(sample))
    .filter(Boolean)
    .filter((sample) => now - sample.capturedAt <= maxAgeMs)
    .sort((left, right) => left.capturedAt - right.capturedAt)
    .slice(-maxSamples);
};

const blendByAccuracy = (previousSample, currentSample) => {
  const previousAccuracy = normalizeAccuracy(previousSample, 50);
  const currentAccuracy = normalizeAccuracy(currentSample, 50);
  const previousWeight = 1 / previousAccuracy;
  const currentWeight = 1 / currentAccuracy;
  const totalWeight = previousWeight + currentWeight;

  return {
    lat:
      (previousSample.lat * previousWeight + currentSample.lat * currentWeight) /
      totalWeight,
    lng:
      (previousSample.lng * previousWeight + currentSample.lng * currentWeight) /
      totalWeight
  };
};

export const pickStableLocationSample = (
  samples = [],
  { maxAgeMs = 15000, maxSamples = 6, stableRadiusMeters = 20 } = {}
) => {
  const recentSamples = trimLocationSamples(samples, { maxAgeMs, maxSamples });
  if (!recentSamples.length) {
    return null;
  }

  const rankedSamples = [...recentSamples].sort((left, right) => {
    const accuracyDelta = normalizeAccuracy(left) - normalizeAccuracy(right);
    if (accuracyDelta !== 0) return accuracyDelta;
    return right.capturedAt - left.capturedAt;
  });

  const anchor = rankedSamples[0];
  const cluster = recentSamples.filter((sample) => {
    const radius = Math.max(
      stableRadiusMeters,
      normalizeAccuracy(anchor, stableRadiusMeters),
      normalizeAccuracy(sample, stableRadiusMeters)
    );
    return haversineDistanceMeters(anchor, sample) <= radius;
  });

  if (cluster.length === 1) {
    return anchor;
  }

  const aggregate = cluster.reduce(
    (accumulator, sample) => {
      const weight = 1 / normalizeAccuracy(sample, stableRadiusMeters);
      accumulator.totalWeight += weight;
      accumulator.lat += sample.lat * weight;
      accumulator.lng += sample.lng * weight;
      accumulator.bestAccuracy = Math.min(
        accumulator.bestAccuracy,
        normalizeAccuracy(sample, stableRadiusMeters)
      );

      if (sample.capturedAt > accumulator.latestCapturedAt) {
        accumulator.latestCapturedAt = sample.capturedAt;
        accumulator.latestTimestamp = sample.timestamp;
        accumulator.latestMeta = sample;
      }

      return accumulator;
    },
    {
      lat: 0,
      lng: 0,
      totalWeight: 0,
      bestAccuracy: normalizeAccuracy(anchor, stableRadiusMeters),
      latestCapturedAt: anchor.capturedAt,
      latestTimestamp: anchor.timestamp,
      latestMeta: anchor
    }
  );

  return {
    ...aggregate.latestMeta,
    // Accuracy-based weights are fractional, so totalWeight is usually below 1.
    // Dividing by 1 shrinks real coordinates toward zero and produces false locations.
    lat: roundCoordinate(aggregate.lat / (aggregate.totalWeight > 0 ? aggregate.totalWeight : 1)),
    lng: roundCoordinate(aggregate.lng / (aggregate.totalWeight > 0 ? aggregate.totalWeight : 1)),
    accuracy: aggregate.bestAccuracy,
    timestamp: aggregate.latestTimestamp,
    capturedAt: aggregate.latestCapturedAt
  };
};

export const resolveStableLocation = (
  previousLocation,
  nextLocation,
  {
    stableRadiusMeters = 20,
    blendMultiplier = 1.6,
    accuracyRegressionToleranceMeters = 5
  } = {}
) => {
  const previousSample = normalizeLocationSample(previousLocation);
  const currentSample = normalizeLocationSample(nextLocation);

  if (!previousSample) return currentSample;
  if (!currentSample) return previousSample;

  const distanceMeters = haversineDistanceMeters(previousSample, currentSample);
  const previousAccuracy = normalizeAccuracy(previousSample, stableRadiusMeters);
  const currentAccuracy = normalizeAccuracy(currentSample, stableRadiusMeters);
  const overlapRadius = Math.max(
    stableRadiusMeters,
    previousAccuracy,
    currentAccuracy
  );

  if (
    distanceMeters <= overlapRadius &&
    currentAccuracy >= previousAccuracy + accuracyRegressionToleranceMeters
  ) {
    return {
      ...currentSample,
      lat: previousSample.lat,
      lng: previousSample.lng,
      accuracy: Math.max(previousAccuracy, currentAccuracy),
      stability: 'hold_previous',
      distanceFromPreviousMeters: Number(distanceMeters.toFixed(2))
    };
  }

  if (
    distanceMeters <= overlapRadius * blendMultiplier &&
    currentAccuracy > previousAccuracy
  ) {
    const blended = blendByAccuracy(previousSample, currentSample);
    return {
      ...currentSample,
      lat: roundCoordinate(blended.lat),
      lng: roundCoordinate(blended.lng),
      accuracy: Math.max(previousAccuracy, currentAccuracy),
      stability: 'blend_previous',
      distanceFromPreviousMeters: Number(distanceMeters.toFixed(2))
    };
  }

  return {
    ...currentSample,
    stability: 'raw',
    distanceFromPreviousMeters: Number(distanceMeters.toFixed(2))
  };
};

export const stabilizeLocationSamples = ({
  previous = null,
  samples = [],
  options = {}
} = {}) => {
  const candidate = pickStableLocationSample(samples, options);
  if (!candidate) {
    return normalizeLocationSample(previous);
  }

  return resolveStableLocation(previous, candidate, options);
};
