const fp = require('fastify-plugin');
const jwt = require('@fastify/jwt');

async function authPlugin(fastify, options) {
  fastify.register(jwt, {
    secret: fastify.config.JWT_SECRET,
  });

  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      throw fastify.httpErrors.unauthorized('Invalid or missing token');
    }
  });

  fastify.decorate('authorize', (allowedRoles) => {
    return async (request, reply) => {
      if (!request.user || !allowedRoles.includes(request.user.role)) {
        throw fastify.httpErrors.forbidden('You do not have permission to perform this action');
      }
    };
  });
}

module.exports = fp(authPlugin, { name: 'auth' });
