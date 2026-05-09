process.env.USE_MOCKS = 'true';
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const app = require('../src/index');

describe('Health endpoint', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.mode).toBe('mock');
  });
});

describe('Auth - registration', () => {
  it('rejects empty body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});
    expect(res.status).toBe(400);
  });

  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `test-${Date.now()}@example.com`,
        password: 'testpass123',
        displayName: 'Test User'
      });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('consumer');
  });
});

describe('Photos - access control', () => {
  it('rejects unauthenticated upload', async () => {
    const res = await request(app).post('/api/photos');
    expect(res.status).toBe(401);
  });

  it('lists photos publicly', async () => {
    const res = await request(app).get('/api/photos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});