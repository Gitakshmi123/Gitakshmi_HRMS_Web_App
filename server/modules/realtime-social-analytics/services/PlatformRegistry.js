const FacebookGraphService = require('./platforms/FacebookGraphService');
const InstagramGraphService = require('./platforms/InstagramGraphService');
const LinkedInApiService = require('./platforms/LinkedInApiService');

class PlatformRegistry {
  constructor(tokenService) {
    this.services = {
      facebook: new FacebookGraphService(tokenService),
      instagram: new InstagramGraphService(tokenService),
      linkedin: new LinkedInApiService(tokenService)
    };
  }

  get(platform) {
    const service = this.services[String(platform || '').toLowerCase()];
    if (!service) {
      throw new Error(`Unsupported analytics platform: ${platform}`);
    }
    return service;
  }
}

module.exports = PlatformRegistry;
