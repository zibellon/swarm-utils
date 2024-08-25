import { Router } from 'express';
import { logError } from 'src/utils/utils-logger';
import { cleanServiceExec } from '../services/clean.service';

const router = Router();

router.post('/api/clean/service', async (req, res, next) => {
  const tokenBody = req.body.token;
  const serviceNameBody = req.body.serviceName;

  if (typeof tokenBody !== 'string' || tokenBody.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }
  if (typeof serviceNameBody !== 'string' || serviceNameBody.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }

  try {
    await cleanServiceExec({
      token: tokenBody,
      serviceName: serviceNameBody,
    });
  } catch (err) {
    logError('request.clean.API_ERROR', err, {
      body: req.body,
    });

    res.status(400).json({
      message: 'ApiError',
    });
    return;
  }

  res.json({
    message: 'Ok',
  });
});

export { router as apiCleanRouter };
