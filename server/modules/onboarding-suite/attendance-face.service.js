const { getOnboardingSuiteModels } = require('./models');
const { encryptJson, decryptJson, hmac } = require('./security');

function assertDescriptor(descriptor) {
  if (!Array.isArray(descriptor) || descriptor.length < 64) {
    throw Object.assign(new Error('invalid_face_descriptor'), { status: 400 });
  }
  if (!descriptor.every((value) => Number.isFinite(Number(value)))) {
    throw Object.assign(new Error('face_descriptor_must_be_numeric'), { status: 400 });
  }
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += Number(a[index]) * Number(b[index]);
    normA += Number(a[index]) ** 2;
    normB += Number(b[index]) ** 2;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function validateGeo(geo = {}) {
  if (!Number.isFinite(Number(geo.lat)) || !Number.isFinite(Number(geo.lng))) {
    throw Object.assign(new Error('gps_required'), { status: 400 });
  }
  if (Number(geo.accuracy || 9999) > 100) {
    throw Object.assign(new Error('gps_accuracy_too_low'), { status: 400 });
  }
}

class AttendanceFaceService {
  async ensureAttendanceProfile({ tenantId, companyId, assignment, employeeId, actor }) {
    const models = getOnboardingSuiteModels();
    return models.AttendanceProfile.findOneAndUpdate(
      { tenant: tenantId, employee: employeeId },
      {
        $setOnInsert: {
          company: companyId || tenantId,
          assignment: assignment._id || assignment,
          allowedModes: ['face_gps'],
        },
        $set: {
          activationStatus: 'pending_face',
          attendanceEnabled: false,
          activatedBy: actor?._id || actor?.id || null,
        },
      },
      { upsert: true, new: true }
    );
  }

  async registerFace({ tenantId, companyId, assignmentId, employeeId, descriptor, geo, liveness = {}, deviceId = '' }) {
    assertDescriptor(descriptor);
    validateGeo(geo);
    const livenessScore = Number(liveness.score || 0);
    if (livenessScore < 0.75) throw Object.assign(new Error('liveness_failed'), { status: 400 });

    const models = getOnboardingSuiteModels();
    return models.FaceProfile.create({
      tenant: tenantId,
      company: companyId || tenantId,
      assignment: assignmentId,
      employee: employeeId,
      encryptedDescriptor: encryptJson(descriptor.map(Number)),
      descriptorHash: hmac(descriptor.map((value) => Number(value).toFixed(6)).join(',')),
      encryptionKeyVersion: 'v1',
      livenessScore,
      registeredGeo: geo,
      deviceId,
      status: 'pending',
    });
  }

  async approveFace({ faceProfileId, actor, approved, reason = '' }) {
    const models = getOnboardingSuiteModels();
    const face = await models.FaceProfile.findById(faceProfileId);
    if (!face) throw Object.assign(new Error('face_profile_not_found'), { status: 404 });
    face.status = approved ? 'approved' : 'rejected';
    face.approvedBy = approved ? (actor?._id || actor?.id || null) : null;
    face.approvedAt = approved ? new Date() : null;
    face.rejectionReason = approved ? '' : (reason || 'Face profile rejected');
    await face.save();

    await models.AttendanceProfile.findOneAndUpdate(
      { tenant: face.tenant, employee: face.employee },
      {
        $set: {
          activationStatus: approved ? 'active' : 'pending_face',
          attendanceEnabled: approved,
          activatedBy: actor?._id || actor?.id || null,
          activatedAt: approved ? new Date() : null,
        },
      }
    );
    return face;
  }

  async verifyFace({ tenantId, employeeId, descriptor, geo, liveness = {}, deviceId = '' }) {
    assertDescriptor(descriptor);
    validateGeo(geo);
    if (Number(liveness.score || 0) < 0.75) throw Object.assign(new Error('liveness_failed'), { status: 400 });

    const models = getOnboardingSuiteModels();
    const attendanceProfile = await models.AttendanceProfile.findOne({ tenant: tenantId, employee: employeeId });
    if (!attendanceProfile?.attendanceEnabled) throw Object.assign(new Error('attendance_locked'), { status: 403 });

    const face = await models.FaceProfile.findOne({ tenant: tenantId, employee: employeeId, status: 'approved' }).sort({ updatedAt: -1 });
    if (!face) throw Object.assign(new Error('face_not_registered'), { status: 404 });

    const stored = decryptJson(face.encryptedDescriptor);
    const confidence = cosineSimilarity(stored, descriptor.map(Number));
    if (confidence < 0.86) throw Object.assign(new Error('face_mismatch'), { status: 403 });

    return {
      verified: true,
      confidence,
      faceProfileId: face._id,
      sessionToken: hmac({ employeeId, deviceId, confidence, timestamp: Date.now() }),
    };
  }

  async punch({ tenantId, companyId, employeeId, type, verification, geo, device = {} }) {
    validateGeo(geo);
    const models = getOnboardingSuiteModels();
    const profile = await models.AttendanceProfile.findOne({ tenant: tenantId, employee: employeeId });
    if (!profile?.attendanceEnabled) throw Object.assign(new Error('attendance_locked'), { status: 403 });

    const latest = await models.AttendancePunch.findOne({ tenant: tenantId, employee: employeeId }).sort({ punchTime: -1 }).lean();
    if (type === 'punch_in' && latest?.type === 'punch_in') {
      throw Object.assign(new Error('already_punched_in'), { status: 409 });
    }
    if (type === 'punch_out' && (!latest || latest.type !== 'punch_in')) {
      throw Object.assign(new Error('no_open_attendance_session'), { status: 409 });
    }

    return models.AttendancePunch.create({
      tenant: tenantId,
      company: companyId || tenantId,
      employee: employeeId,
      type,
      verification,
      geo,
      device,
      status: 'valid',
    });
  }
}

module.exports = { AttendanceFaceService, cosineSimilarity };
