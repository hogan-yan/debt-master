import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendMail = vi.hoisted(() => vi.fn());
const mockCreateTransport = vi.hoisted(() => vi.fn(() => ({ sendMail: mockSendMail })));

vi.mock('nodemailer', () => ({
  createTransport: mockCreateTransport,
}));

const originalEnv = process.env;

import { sendEmail } from '@/server/infrastructure/email';

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sends via SMTP when configured', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    process.env.SMTP_FROM = 'from@example.com';
    process.env.NODE_ENV = 'development';

    mockSendMail.mockResolvedValue({});

    await sendEmail({
      to: 'to@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      auth: { user: 'user', pass: 'pass' },
      secure: false,
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });
  });

  it('uses secure transport for port 465', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    process.env.NODE_ENV = 'development';

    mockSendMail.mockResolvedValue({});
    await sendEmail({ to: 'to@example.com', subject: 'Test', html: '' });

    expect(mockCreateTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
  });

  it('uses the default SMTP port when one is not configured', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    process.env.NODE_ENV = 'development';
    mockSendMail.mockResolvedValue({});

    await sendEmail({ to: 'to@example.com', subject: 'Test', html: '' });

    expect(mockCreateTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587 }));
  });

  it('logs in development when SMTP is not configured', async () => {
    process.env.NODE_ENV = 'development';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await sendEmail({ to: 'to@example.com', subject: 'Test', html: '<p>Hi</p>' });

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();

    infoSpy.mockRestore();
  });

  it('throws in production when SMTP port is not a number', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = 'not-a-number';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';

    await expect(
      sendEmail({ to: 'to@example.com', subject: 'Test', html: '<p>Hi</p>' })
    ).rejects.toThrow('SMTP is not configured');
  });

  it('throws in production when SMTP is not configured', async () => {
    process.env.NODE_ENV = 'production';

    await expect(
      sendEmail({ to: 'to@example.com', subject: 'Test', html: '<p>Hi</p>' })
    ).rejects.toThrow('SMTP is not configured');

    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
