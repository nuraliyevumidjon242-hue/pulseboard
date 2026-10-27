import { Router, type Request } from 'express';
import { REFRESH_COOKIE_NAME } from '../../config/env';
import { asyncHandler } from '../../lib/async-handler';
import { created, sendData } from '../../lib/http';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import { clearRefreshCookie, setRefreshCookie } from './cookies';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './schemas';
import {
  changePassword,
  getMe,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  revokeAllSessions,
  revokeRefreshToken,
  rotateRefreshToken,
  updateProfile,
} from './service';

const meta = (req: Request) => ({
  userAgent: req.headers['user-agent'] ?? null,
  ipAddress: req.ip ?? null,
});

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await registerUser(req.body, meta(req));
    setRefreshCookie(res, result.tokens.refreshToken, true);
    return created(res, {
      user: result.user,
      storeId: result.storeId,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await loginUser(req.body, meta(req));
    setRefreshCookie(res, result.tokens.refreshToken, Boolean(req.body.rememberMe));
    return sendData(res, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    });
  }),
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body.refreshToken;
    if (!rawToken) {
      clearRefreshCookie(res);
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' },
      });
    }

    try {
      const result = await rotateRefreshToken(rawToken, meta(req));
      setRefreshCookie(res, result.tokens.refreshToken, result.tokens.remember);
      return sendData(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      });
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE_NAME]);
    clearRefreshCookie(res);
    return sendData(res, { message: 'Logged out successfully' });
  }),
);

authRouter.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user) await revokeAllSessions(req.user.id);
    clearRefreshCookie(res);
    return sendData(res, { message: 'All sessions revoked' });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await getMe(req.user!.id);
    return sendData(res, result);
  }),
);

authRouter.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await updateProfile(req.user!.id, req.body);
    return sendData(res, { user });
  }),
);

authRouter.post(
  '/change-password',
  authenticate,
  authLimiter,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    return sendData(res, { message: 'Password updated successfully' });
  }),
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await requestPasswordReset(req.body.email, meta(req));
    return sendData(res, {
      message: 'If an account exists for that email, a reset link has been sent.',
      ...result,
    });
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await resetPassword(req.body.token, req.body.password);
    return sendData(res, { message: 'Password has been reset. Please sign in.' });
  }),
);
