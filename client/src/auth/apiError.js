export class ApiError extends Error {
  constructor(message, { status = 0, details = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = Array.isArray(details)
      ? details.filter((detail) => typeof detail === 'string')
      : [];
  }
}
