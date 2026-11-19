import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter, ErrorBody } from './all-exceptions.filter';

function hostFor(method = 'POST', url = '/api/auth/signup') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method, url }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, body: () => json.mock.calls[0]?.[0] as ErrorBody };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let logged: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logged.mockRestore();
  });

  it('keeps the status and reason of a refusal', () => {
    const { host, status, body } = hostFor();

    filter.catch(new ConflictException('Email already registered'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(body().message).toBe('Email already registered');
    expect(body().error).toBe('Conflict');
  });

  it('preserves the array of validation messages', () => {
    // The frontend reads body.message to explain a 400 — api.errors.ts takes
    // the first entry. Flattening this into one tidy string would blank every
    // field-level message the person needs to see.
    const { host, body } = hostFor();

    filter.catch(
      new BadRequestException(['email must be an email', 'password is too short']),
      host,
    );

    expect(body().message).toEqual([
      'email must be an email',
      'password is too short',
    ]);
  });

  it('passes a throttler refusal straight through', () => {
    const { host, status, body } = hostFor();

    filter.catch(new ThrottlerException(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(body().statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  describe('something that is not an HttpException', () => {
    const driverError = new QueryFailedError(
      'SELECT * FROM users WHERE email = ?',
      ['adi@example.com'],
      new Error("Unknown column 'passwrd' in 'field list'"),
    );

    it('answers 500 and says nothing about why', () => {
      const { host, status, body } = hostFor();

      filter.catch(driverError, host);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body().message).toBe('Internal server error');

      // the query, the column name and the parameters are all in that error;
      // none of them belong in a response
      const sent = JSON.stringify(body());
      expect(sent).not.toContain('passwrd');
      expect(sent).not.toContain('SELECT');
      expect(sent).not.toContain('adi@example.com');
    });

    it('logs it with a stack, because a 500 is ours to fix', () => {
      const { host } = hostFor();

      filter.catch(driverError, host);

      expect(logged).toHaveBeenCalledTimes(1);
      expect(logged.mock.calls[0][0]).toContain('/api/auth/signup');
    });
  });

  it('does not log a refusal, which would only drown the log', () => {
    const { host } = hostFor();

    filter.catch(new ConflictException(), host);

    expect(logged).not.toHaveBeenCalled();
  });

  it('spells the reason the same way whichever layer refused', () => {
    // A guard's UnauthorizedException carries no `error` field, so the reason
    // is derived — and HttpStatus[401] is 'UNAUTHORIZED'. Without title-casing
    // that lands next to AuthService's 'Unauthorized' in the same API.
    const { host, body } = hostFor();

    filter.catch(new UnauthorizedException(), host);

    expect(body().error).toBe('Unauthorized');
  });

  it('title-cases a multi-word reason', () => {
    const { host, body } = hostFor();

    filter.catch(new NotFoundException(), host);

    expect(body().error).toBe('Not Found');
  });

  it('records where and when, for matching a report to a log line', () => {
    const { host, body } = hostFor('GET', '/api/beats/9');

    filter.catch(new ConflictException(), host);

    expect(body().path).toBe('/api/beats/9');
    expect(Number.isNaN(Date.parse(body().timestamp))).toBe(false);
  });
});
