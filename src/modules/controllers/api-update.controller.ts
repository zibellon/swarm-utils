import { Router } from 'express';
import { logError } from 'src/utils/utils-logger';
import { updateServiceExec } from '../services/update.service';

const router = Router();

router.post('/api/update/service', async (req, res, next) => {
  const tokenBody = req.body.token;
  const serviceNameBody = req.body.serviceName;
  const isRegistryAuthBody = req.body.isRegistryAuth;
  const isForceBody = req.body.isForce;
  const imageBody = req.body.image;

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
    await updateServiceExec({
      token: tokenBody,
      serviceName: serviceNameBody,
      registryAuth: typeof isRegistryAuthBody === 'boolean' ? isRegistryAuthBody : false,
      force: typeof isForceBody === 'boolean' ? isForceBody : false,
      image: typeof imageBody === 'string' && imageBody.length > 0 ? imageBody : undefined,
    });
  } catch (err) {
    logError('request.update.API_ERROR', err, {
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

export { router as apiUpdateRouter };
