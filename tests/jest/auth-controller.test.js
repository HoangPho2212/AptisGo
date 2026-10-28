jest.mock('../../server/src/utils/jwt', () => ({
  signAccessToken: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

const User = require('../../server/src/models/User');
const { signAccessToken } = require('../../server/src/utils/jwt');
const { register, login } = require('../../server/src/controllers/authController');
const { authorizeRoles } = require('../../server/src/middleware/authMiddleware');

const VALID_REGISTER = {
  name: 'Amina Rahman',
  email: 'amina@greenwich.edu.vn',
  password: 'Placement2026!',
};

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function createUser(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    name: VALID_REGISTER.name,
    email: VALID_REGISTER.email,
    role: 'student',
    currentLevel: 'UNTESTED',
    verifyPassword: jest.fn().mockResolvedValue(true),
    toJSON() {
      return {
        _id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        currentLevel: this.currentLevel,
      };
    },
    ...overrides,
  };
}

beforeEach(() => {
  signAccessToken.mockReset();
  signAccessToken.mockReturnValue('signed.jwt.token');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TC01 registration happy path', () => {
  it('creates a student, issues a Bearer JWT, and never returns the password', async () => {
    const user = createUser();
    jest.spyOn(User, 'exists').mockResolvedValue(null);
    const create = jest.spyOn(User, 'create').mockResolvedValue(user);
    const response = createResponse();

    await register({ body: VALID_REGISTER }, response);

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({
      token: 'signed.jwt.token',
      tokenType: 'Bearer',
      user: {
        _id: user._id,
        email: VALID_REGISTER.email,
        role: 'student',
        currentLevel: 'UNTESTED',
      },
    });
    expect(response.body.user.password).toBeUndefined();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: VALID_REGISTER.name,
        email: VALID_REGISTER.email,
        password: VALID_REGISTER.password,
      })
    );
    expect(signAccessToken).toHaveBeenCalledWith(user);
  });

  it('returns 400 validation details without touching the database', async () => {
    const exists = jest.spyOn(User, 'exists');
    const create = jest.spyOn(User, 'create');
    const response = createResponse();

    await register({ body: {} }, response);

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toEqual(
      expect.arrayContaining(['name is required', 'email is required', 'password is required'])
    );
    expect(exists).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('TC02 duplicate email negative path', () => {
  it('returns 409 and does not create a second account', async () => {
    jest.spyOn(User, 'exists').mockResolvedValue({ _id: 'existing-user' });
    const create = jest.spyOn(User, 'create');
    const response = createResponse();

    await register({ body: VALID_REGISTER }, response);

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: 'Email is already registered' });
    expect(create).not.toHaveBeenCalled();
    expect(signAccessToken).not.toHaveBeenCalled();
  });
});

describe('TC03 login paths', () => {
  it('returns 200 and a Bearer JWT for valid credentials', async () => {
    const user = createUser();
    const select = jest.fn().mockResolvedValue(user);
    const findOne = jest.spyOn(User, 'findOne').mockReturnValue({ select });
    const response = createResponse();

    await login(
      { body: { email: VALID_REGISTER.email, password: VALID_REGISTER.password } },
      response
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      token: 'signed.jwt.token',
      tokenType: 'Bearer',
      user: { email: VALID_REGISTER.email, role: 'student' },
    });
    expect(findOne).toHaveBeenCalledWith({ email: VALID_REGISTER.email });
    expect(select).toHaveBeenCalledWith('+password');
    expect(signAccessToken).toHaveBeenCalledWith(user);
  });

  it('returns 401 for a wrong password', async () => {
    const user = createUser({ verifyPassword: jest.fn().mockResolvedValue(false) });
    jest.spyOn(User, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });
    const response = createResponse();

    await login({ body: { email: VALID_REGISTER.email, password: 'WrongPassword1!' } }, response);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid email or password' });
    expect(signAccessToken).not.toHaveBeenCalled();
  });

  it('returns the same 401 body for an unknown email', async () => {
    jest.spyOn(User, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    const response = createResponse();

    await login(
      { body: { email: 'missing@greenwich.edu.vn', password: VALID_REGISTER.password } },
      response
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid email or password' });
    expect(signAccessToken).not.toHaveBeenCalled();
  });
});

describe('TC03 lecturer role guard', () => {
  it('returns 403 for a student and allows a lecturer', () => {
    const guard = authorizeRoles('lecturer');
    const next = jest.fn();
    const studentResponse = createResponse();
    const lecturerResponse = createResponse();

    guard({ user: { id: 'student-1', role: 'student' } }, studentResponse, next);

    expect(studentResponse.statusCode).toBe(403);
    expect(studentResponse.body).toEqual({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();

    guard({ user: { id: 'lecturer-1', role: 'lecturer' } }, lecturerResponse, next);

    expect(lecturerResponse.statusCode).toBe(200);
    expect(lecturerResponse.body).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
