const { randomUUID } = require('crypto');
const { getOnboardingSuiteModels } = require('./models');

function render(text = '', data = {}) {
  return String(text).replace(/\{\{(\w+)\}\}/g, (_match, key) => data[key] ?? '');
}

class NotificationService {
  constructor({ emailProvider = null, smsProvider = null, whatsappProvider = null, io = null } = {}) {
    this.emailProvider = emailProvider;
    this.smsProvider = smsProvider;
    this.whatsappProvider = whatsappProvider;
    this.io = io;
  }

  async publish({ tenantId, companyId, type, employeeId = null, assignmentId = null, actorId = null, priority = 'normal', payload = {} }) {
    const models = getOnboardingSuiteModels();
    const event = await models.Event.create({
      tenant: tenantId,
      company: companyId || tenantId,
      eventId: randomUUID(),
      type,
      employee: employeeId,
      assignment: assignmentId,
      actor: actorId,
      priority,
      payload,
    });

    this.emitRealtime(tenantId, type, { eventId: event.eventId, employeeId, assignmentId, payload });
    return event;
  }

  async send({ tenantId, companyId, eventId, channel, recipient, templateCode, data = {} }) {
    const models = getOnboardingSuiteModels();
    const template = await models.NotificationTemplate.findOne({
      tenant: tenantId,
      code: String(templateCode || '').toUpperCase(),
      channel,
      isActive: true,
    }).lean();

    const delivery = await models.Delivery.findOneAndUpdate(
      {
        tenant: tenantId,
        eventId,
        channel,
        'recipient.value': recipient.value,
      },
      {
        $setOnInsert: {
          company: companyId || tenantId,
          recipient,
          templateCode,
          status: 'queued',
        },
      },
      { upsert: true, new: true }
    );

    if (delivery.status === 'sent') return delivery;

    try {
      const bodyText = render(template?.bodyText || data.message || '', data);
      const bodyHtml = render(template?.bodyHtml || '', data);
      const subject = render(template?.subject || data.title || 'Onboarding notification', data);

      let providerMessageId = '';
      if (channel === 'email' && this.emailProvider) {
        const result = await this.emailProvider.send({ to: recipient.value, subject, text: bodyText, html: bodyHtml });
        providerMessageId = result?.messageId || '';
      } else if (channel === 'sms' && this.smsProvider) {
        const result = await this.smsProvider.send({ to: recipient.value, text: bodyText });
        providerMessageId = result?.messageId || '';
      } else if (channel === 'whatsapp' && this.whatsappProvider) {
        const result = await this.whatsappProvider.send({ to: recipient.value, text: bodyText });
        providerMessageId = result?.messageId || '';
      } else if (channel === 'in_app') {
        this.emitRealtime(tenantId, 'notification.new', { recipient, title: subject, message: bodyText });
      }

      delivery.status = 'sent';
      delivery.providerMessageId = providerMessageId;
      delivery.sentAt = new Date();
      delivery.attempts += 1;
      await delivery.save();
      return delivery;
    } catch (error) {
      delivery.status = 'failed';
      delivery.attempts += 1;
      delivery.errorMessage = error.message;
      await delivery.save();
      throw error;
    }
  }

  emitRealtime(tenantId, event, payload) {
    if (!this.io) return;
    this.io.to(`tenant:${tenantId}:hr`).emit(event, payload);
    if (payload.employeeId) this.io.to(`employee:${payload.employeeId}`).emit(event, payload);
    if (payload.assignmentId) this.io.to(`onboarding:${payload.assignmentId}`).emit(event, payload);
  }
}

module.exports = { NotificationService };
