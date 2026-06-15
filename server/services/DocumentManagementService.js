/**
 * DOCUMENT MANAGEMENT SERVICE
 * 
 * Core business logic for:
 * - Document lifecycle management
 * - Audit trail tracking
 * - Access control & permissions
 * - Revocation workflows
 * - Status transitions
 * 
 * Clean separation of concerns from controller
 * Fully testable and reusable across different contexts
 */

class DocumentManagementService {
    /**
     * Initialize service with database connection
     */
    constructor(tenantDB) {
        this.tenantDB = tenantDB;
    }

    /**
     * Get models from tenant database
     */
    getModels() {
        return {
            GeneratedLetter: this.tenantDB.model('GeneratedLetter'),
            DocumentAudit: this.tenantDB.model('DocumentAudit'),
            DocumentAccess: this.tenantDB.model('DocumentAccess'),
            LetterRevocation: this.tenantDB.model('LetterRevocation'),
            User: this.tenantDB.model('User'),
            Applicant: this.tenantDB.model('Applicant'),
            Employee: this.tenantDB.model('Employee')
        };
    }

    /**
     * CREATE AUDIT LOG
     * Non-destructive immutable record of all document interactions
     */
    async logAuditAction(auditData) {
        try {
            const { DocumentAudit } = this.getModels();
            const audit = new DocumentAudit({
                tenantId: auditData.tenantId,
                documentId: auditData.documentId,
                applicantId: auditData.applicantId,
                employeeId: auditData.employeeId,
                action: auditData.action,
                performedBy: auditData.performedBy,
                performedByRole: auditData.performedByRole,
                ipAddress: auditData.ipAddress,
                userAgent: auditData.userAgent,
                oldStatus: auditData.oldStatus,
                newStatus: auditData.newStatus,
                reason: auditData.reason,
                metadata: auditData.metadata
            });

            await audit.save();
            console.log(`✅ [AUDIT] Action logged: ${auditData.action} for document ${auditData.documentId}`);
            return audit;
        } catch (error) {
            console.error(`❌ [AUDIT] Error logging action:`, error.message);
            // Don't throw - audit logging should not break main flow
            return null;
        }
    }

    /**
     * GENERATE ACCESS TOKEN
     * Create secure tokenized access link for document sharing
     */
    async generateAccessToken(accessData) {
        try {
            const { DocumentAccess } = this.getModels();
            
            // Ensure at least one recipient is specified
            if (!accessData.grantedToUserId && !accessData.grantedToApplicantId && !accessData.grantedToEmployeeId) {
                throw new Error('At least one recipient must be specified (userId, applicantId, or employeeId)');
            }

            const access = new DocumentAccess({
                tenantId: accessData.tenantId,
                documentId: accessData.documentId,
                grantedToUserId: accessData.grantedToUserId,
                grantedToApplicantId: accessData.grantedToApplicantId,
                grantedToEmployeeId: accessData.grantedToEmployeeId,
                accessLevel: accessData.accessLevel || 'view',
                expiresAt: accessData.expiresAt,
                grantedBy: accessData.grantedBy,
                shareNotes: accessData.shareNotes
            });

            await access.save();
            console.log(`✅ [ACCESS] Token generated: ${access.accessToken}`);
            return access;
        } catch (error) {
            console.error(`❌ [ACCESS] Error generating token:`, error.message);
            throw error;
        }
    }

    /**
     * VALIDATE ACCESS TOKEN
     * Check if token is valid, active, and not expired
     */
    async validateAccessToken(accessToken) {
        try {
            const { DocumentAccess } = this.getModels();
            const access = await DocumentAccess.findOne({
                accessToken,
                isActive: true
            });

            if (!access) {
                return { valid: false, reason: 'Token not found or revoked' };
            }

            if (access.expiresAt && new Date() > access.expiresAt) {
                return { valid: false, reason: 'Token expired' };
            }

            return { valid: true, access };
        } catch (error) {
            console.error(`❌ [ACCESS] Error validating token:`, error.message);
            return { valid: false, reason: 'Validation error' };
        }
    }

    /**
     * REVOKE DOCUMENT ACCESS
     * Non-destructive revocation - marks as inactive but keeps record
     */
    async revokeAccess(accessId, revocationReason) {
        try {
            const { DocumentAccess } = this.getModels();
            const access = await DocumentAccess.findByIdAndUpdate(
                accessId,
                {
                    isActive: false,
                    revokedAt: new Date(),
                    revokedReason: revocationReason
                },
                { new: true }
            );

            console.log(`✅ [ACCESS] Revoked token: ${access.accessToken}`);
            return access;
        } catch (error) {
            console.error(`❌ [ACCESS] Error revoking access:`, error.message);
            throw error;
        }
    }

    /**
     * TRACK DOCUMENT ACCESS
     * Update access count and last accessed timestamp
     */
    async trackDocumentAccess(accessId, documentId) {
        try {
            const { DocumentAccess } = this.getModels();
            
            // Update access count
            await DocumentAccess.findByIdAndUpdate(
                accessId,
                {
                    $inc: { accessCount: 1 },
                    lastAccessedAt: new Date()
                }
            );

            console.log(`✅ [ACCESS] Tracked access for document ${documentId}`);
        } catch (error) {
            console.error(`❌ [ACCESS] Error tracking access:`, error.message);
            // Don't throw - access tracking should not break main flow
        }
    }

    /**
     * REVOKE OFFER/LETTER
     * Create revocation record and update document status
     */
    async revokeLetter(revocationData) {
        try {
            const { GeneratedLetter, LetterRevocation, DocumentAccess } = this.getModels();

            // Validate revocation data
            if (!revocationData.generatedLetterId || !revocationData.revokedBy || !revocationData.reason) {
                throw new Error('Missing required revocation data: generatedLetterId, revokedBy, reason');
            }

            // Get document
            const letter = await GeneratedLetter.findById(revocationData.generatedLetterId);
            if (!letter) {
                throw new Error('Generated letter not found');
            }

            // Check current revocation status
            const existingRevocation = await LetterRevocation.findOne({
                generatedLetterId: revocationData.generatedLetterId,
                status: 'revoked',
                isActive: true
            });

            if (existingRevocation) {
                throw new Error('Document is already revoked');
            }

            // Create revocation record
            const revocation = new LetterRevocation({
                tenantId: revocationData.tenantId,
                generatedLetterId: revocationData.generatedLetterId,
                applicantId: revocationData.applicantId,
                employeeId: revocationData.employeeId,
                revokedBy: revocationData.revokedBy,
                revokedByRole: revocationData.revokedByRole,
                reason: revocationData.reason,
                reasonDetails: revocationData.reasonDetails,
                letterSnapshot: {
                    letterType: letter.letterType,
                    status: letter.status,
                    templateId: letter.templateId,
                    generatedAt: letter.createdAt,
                    pdfPath: letter.pdfPath
                }
            });

            await revocation.save();

            // Update letter status to 'revoked'
            await GeneratedLetter.findByIdAndUpdate(
                revocationData.generatedLetterId,
                { 
                    status: 'revoked',
                    revokedAt: new Date(),
                    revokedReason: revocationData.reasonDetails
                }
            );

            // Disable all active access tokens for this document
            await DocumentAccess.updateMany(
                {
                    documentId: revocationData.generatedLetterId,
                    isActive: true
                },
                {
                    isActive: false,
                    revokedAt: new Date(),
                    revokedReason: 'Document revoked'
                }
            );

            console.log(`✅ [REVOCATION] Letter revoked: ${revocationData.generatedLetterId}`);
            return revocation;
        } catch (error) {
            console.error(`❌ [REVOCATION] Error revoking letter:`, error.message);
            throw error;
        }
    }

    /**
     * REINSTATE REVOKED LETTER
     * Only super-admin can reinstate (reversible)
     */
    async reinstateLetter(revocationId, reinstateData) {
        try {
            const { GeneratedLetter, LetterRevocation } = this.getModels();

            // Validate permission
            if (reinstateData.reinstatedByRole !== 'super_admin') {
                throw new Error('Only super-admin can reinstate revoked documents');
            }

            // Get revocation record
            const revocation = await LetterRevocation.findById(revocationId);
            if (!revocation) {
                throw new Error('Revocation record not found');
            }

            if (revocation.status !== 'revoked') {
                throw new Error('Document is not in revoked status');
            }

            // Update revocation record
            const updatedRevocation = await LetterRevocation.findByIdAndUpdate(
                revocationId,
                {
                    status: 'reinstated',
                    reinstatedBy: reinstateData.reinstatedBy,
                    reinstatedByRole: reinstateData.reinstatedByRole,
                    reinstatedAt: new Date(),
                    reinstatedReason: reinstateData.reinstatedReason
                },
                { new: true }
            );

            // Restore letter status
            await GeneratedLetter.findByIdAndUpdate(
                revocation.generatedLetterId,
                {
                    status: revocation.letterSnapshot.status,
                    revokedAt: null,
                    revokedReason: null
                }
            );

            console.log(`✅ [REINSTATE] Letter reinstated: ${revocation.generatedLetterId}`);
            return updatedRevocation;
        } catch (error) {
            console.error(`❌ [REINSTATE] Error reinstating letter:`, error.message);
            throw error;
        }
    }

    /**
     * GET DOCUMENT AUDIT TRAIL
     * Complete history of all interactions with a document
     */
    async getAuditTrail(documentId, tenantId, limit = 100) {
        try {
            const { DocumentAudit } = this.getModels();
            const trail = await DocumentAudit.find({
                documentId,
                tenantId
            })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate('performedBy', 'name email');

            return trail;
        } catch (error) {
            console.error(`❌ [AUDIT] Error fetching audit trail:`, error.message);
            throw error;
        }
    }

    /**
     * GET REVOCATION HISTORY
     * Track all revocation and reinstatement events for a document
     */
    async getRevocationHistory(generatedLetterId, tenantId) {
        try {
            const { LetterRevocation } = this.getModels();
            const history = await LetterRevocation.find({
                generatedLetterId,
                tenantId
            })
            .sort({ revokedAt: -1 })
            .populate('revokedBy', 'name email')
            .populate('reinstatedBy', 'name email');

            return history;
        } catch (error) {
            console.error(`❌ [REVOCATION] Error fetching history:`, error.message);
            throw error;
        }
    }

    /**
     * CHECK DOCUMENT STATUS
     * Get current revocation status of a document
     */
    async getDocumentStatus(documentId, tenantId) {
        try {
            const { GeneratedLetter, LetterRevocation } = this.getModels();

            const letter = await GeneratedLetter.findById(documentId);
            if (!letter) return { status: 'not_found', isRevoked: false };

            const revocation = await LetterRevocation.findOne({
                generatedLetterId: documentId,
                tenantId,
                status: 'revoked',
                isActive: true
            });

            return {
                documentId: letter._id,
                status: revocation ? 'revoked' : letter.status,
                letterStatus: letter.status,
                isRevoked: !!revocation,
                revocationId: revocation?._id || null,
                revocationReason: revocation?.reason || null,
                revocationDetails: revocation?.reasonDetails || null,
                revokedAt: revocation?.revokedAt || null,
                revokedBy: revocation?.revokedBy || null,
                canBeReinstate: !!revocation
            };
        } catch (error) {
            console.error(`❌ [STATUS] Error checking document status:`, error.message);
            throw error;
        }
    }

    /**
     * ENFORCE ACCESS CONTROL
     * Check if user has permission to access document
     */
    async enforceAccessControl(documentId, userId, tenantId, requiredAction = 'view') {
        try {
            const { GeneratedLetter, LetterRevocation } = this.getModels();

            // Check if document is revoked
            const revocation = await LetterRevocation.findOne({
                generatedLetterId: documentId,
                tenantId,
                status: 'revoked',
                isActive: true
            });

            if (revocation) {
                throw new Error(`Access denied: Document has been revoked (${revocation.reason})`);
            }

            // Check if document exists
            const letter = await GeneratedLetter.findById(documentId);
            if (!letter) {
                throw new Error('Document not found');
            }

            // Check document expiration (if applicable)
            if (letter.expiresAt && new Date() > letter.expiresAt) {
                throw new Error('Document access expired');
            }

            return { allowed: true, document: letter };
        } catch (error) {
            console.error(`❌ [ACCESS CONTROL] ${error.message}`);
            throw error;
        }
    }
}

module.exports = DocumentManagementService;
