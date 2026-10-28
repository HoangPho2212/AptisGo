import { describe, expect, it } from 'vitest';

import {
  normalizeEmail,
  validateEmail,
  validateLoginForm,
  validateName,
  validatePassword,
  validateRegisterForm,
  validateStudentId,
} from '../client/src/auth/authValidation.js';

describe('email Contract', () => {
  it('accepts any valid email address regardless of domain', () => {
    expect(validateEmail('Amina.Rahman@GREENWICH.EDU.VN')).toBeNull();
    expect(validateEmail('amina@gmail.com')).toBeNull();
    expect(validateEmail('amina@fpt.edu.vn')).toBeNull();
    expect(validateEmail('student@university.edu')).toBeNull();
    expect(normalizeEmail('  Amina.Rahman@GREENWICH.EDU.VN  ')).toBe(
      'amina.rahman@greenwich.edu.vn'
    );
  });

  it('rejects malformed and empty addresses', () => {
    expect(validateEmail('')).toMatch(/required/i);
    expect(validateEmail('not-an-email')).toMatch(/valid email/i);
  });
});

describe('field validation Contract', () => {
  it('enforces the password length bounds', () => {
    expect(validatePassword('short')).toMatch(/8/);
    expect(validatePassword('12345678')).toBeNull();
    expect(validatePassword('x'.repeat(73))).toMatch(/8/);
  });

  it('allows an empty student ID but rejects a malformed one', () => {
    expect(validateStudentId('')).toBeNull();
    expect(validateStudentId('GCS210884')).toBeNull();
    expect(validateStudentId('GCS 210884!')).toMatch(/Student ID/i);
  });

  it('rejects an empty or overlong full name', () => {
    expect(validateName('')).toMatch(/required/i);
    expect(validateName('x'.repeat(81))).toMatch(/80/);
    expect(validateName('Amina Rahman')).toBeNull();
  });
});

describe('login ViewState Contract', () => {
  it('requires a valid role, email, and password', () => {
    const errors = validateLoginForm({ email: '', password: '', role: 'owner' });

    expect(errors.email).toMatch(/required/i);
    expect(errors.password).toMatch(/required/i);
    expect(errors.role).toMatch(/valid role/i);
  });

  it('accepts a valid student login', () => {
    expect(
      validateLoginForm({
        email: 'amina@fpt.edu.vn',
        password: 'Placement2026!',
        role: 'student',
      })
    ).toEqual({});
  });
});

describe('registration ViewState Contract', () => {
  const validRegistration = {
    name: 'Amina Rahman',
    studentId: 'GCS210884',
    email: 'amina@fpt.edu.vn',
    password: 'Placement2026!',
    confirmPassword: 'Placement2026!',
    gdprConsent: true,
  };

  it('accepts a complete student registration', () => {
    expect(validateRegisterForm(validRegistration)).toEqual({});
  });

  it('requires consent and matching passwords', () => {
    const errors = validateRegisterForm({
      ...validRegistration,
      confirmPassword: 'Different2026!',
      gdprConsent: false,
    });

    expect(errors.confirmPassword).toMatch(/do not match/i);
    expect(errors.gdprConsent).toMatch(/consent/i);
  });

  it('accepts any valid email at registration', () => {
    expect(
      validateRegisterForm({
        ...validRegistration,
        email: 'amina@gmail.com',
      })
    ).toEqual({});
  });
});
